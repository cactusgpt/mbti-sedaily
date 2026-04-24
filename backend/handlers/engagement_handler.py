"""
Article Engagement Handler Lambda Function
Handles reactions, ratings, and comments for articles.

Storage: sedaily-mbti-engagement-dev (separate table, PK=pk, SK=sk).
This table is independent from the Article DB (DynamoDB pointer + S3 body)
and the Personal DB. It stores engagement data keyed by article_id.

No changes needed for the Article DB split — this handler never reads
article body content, only uses article_id as a reference key.
"""
import logging
import boto3
import json
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional

from config.constants import (
    DYNAMODB_TABLE_ARTICLES_DEV,
    CORS_HEADERS,
    MBTI_GROUPS,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# Engagement table name (we'll use a separate table for engagement data)
ENGAGEMENT_TABLE = 'sedaily-mbti-engagement-dev'


def get_engagement_table():
    """Get or create engagement table"""
    return dynamodb.Table(ENGAGEMENT_TABLE)


def decimal_to_float(obj):
    """Convert Decimal to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(i) for i in obj]
    return obj


# =============================================================================
# Reactions
# =============================================================================

def get_reactions(article_id: str) -> Dict[str, Any]:
    """Get reaction counts for an article"""
    table = get_engagement_table()

    try:
        response = table.get_item(
            Key={
                'pk': f'ARTICLE#{article_id}',
                'sk': 'REACTIONS'
            }
        )

        item = response.get('Item', {})
        return {
            'like': int(item.get('like', 0)),
            'fire': int(item.get('fire', 0)),
            'thinking': int(item.get('thinking', 0)),
            'mustRead': int(item.get('mustRead', 0)),
        }
    except Exception as e:
        logger.error(f"Error getting reactions: {e}")
        return {'like': 0, 'fire': 0, 'thinking': 0, 'mustRead': 0}


def toggle_reaction(article_id: str, reaction_type: str, user_id: str) -> Dict[str, Any]:
    """Toggle a reaction for an article"""
    table = get_engagement_table()

    valid_reactions = ['like', 'fire', 'thinking', 'mustRead']
    if reaction_type not in valid_reactions:
        raise ValueError(f"Invalid reaction type: {reaction_type}")

    # Check if user already reacted
    user_reaction_key = {
        'pk': f'ARTICLE#{article_id}',
        'sk': f'USER_REACTION#{user_id}#{reaction_type}'
    }

    try:
        # Check existing reaction
        response = table.get_item(Key=user_reaction_key)
        already_reacted = 'Item' in response

        if already_reacted:
            # Remove reaction
            table.delete_item(Key=user_reaction_key)

            # Decrement count (use ExpressionAttributeNames for reserved keywords like 'like')
            table.update_item(
                Key={
                    'pk': f'ARTICLE#{article_id}',
                    'sk': 'REACTIONS'
                },
                UpdateExpression='SET #attr = if_not_exists(#attr, :zero) - :dec',
                ExpressionAttributeNames={
                    '#attr': reaction_type
                },
                ExpressionAttributeValues={
                    ':dec': 1,
                    ':zero': 0
                }
            )
            action = 'removed'
        else:
            # Add reaction
            table.put_item(Item={
                **user_reaction_key,
                'created_at': datetime.now().isoformat(),
            })

            # Increment count (use ExpressionAttributeNames for reserved keywords like 'like')
            table.update_item(
                Key={
                    'pk': f'ARTICLE#{article_id}',
                    'sk': 'REACTIONS'
                },
                UpdateExpression='SET #attr = if_not_exists(#attr, :zero) + :inc',
                ExpressionAttributeNames={
                    '#attr': reaction_type
                },
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':zero': 0
                }
            )
            action = 'added'

        # Get updated counts
        reactions = get_reactions(article_id)

        return {
            'action': action,
            'reaction_type': reaction_type,
            'reactions': reactions
        }

    except Exception as e:
        logger.error(f"Error toggling reaction: {e}")
        raise


# =============================================================================
# Ratings
# =============================================================================

def get_rating_stats(article_id: str) -> Dict[str, Any]:
    """Get rating statistics for an article"""
    table = get_engagement_table()

    try:
        response = table.get_item(
            Key={
                'pk': f'ARTICLE#{article_id}',
                'sk': 'RATING_STATS'
            }
        )

        item = response.get('Item', {})
        total = int(item.get('total_ratings', 0))
        sum_ratings = float(item.get('sum_ratings', 0))

        return {
            'average': round(sum_ratings / total, 1) if total > 0 else 0,
            'count': total,
        }
    except Exception as e:
        logger.error(f"Error getting rating stats: {e}")
        return {'average': 0, 'count': 0}


def submit_rating(article_id: str, user_id: str, rating: int) -> Dict[str, Any]:
    """Submit a rating for an article"""
    table = get_engagement_table()

    if not 1 <= rating <= 5:
        raise ValueError("Rating must be between 1 and 5")

    user_rating_key = {
        'pk': f'ARTICLE#{article_id}',
        'sk': f'USER_RATING#{user_id}'
    }

    try:
        # Check if user already rated
        response = table.get_item(Key=user_rating_key)

        if 'Item' in response:
            # User already rated - update not allowed
            return {
                'success': False,
                'message': '이미 평가하셨습니다.',
                'stats': get_rating_stats(article_id)
            }

        # Save user rating
        table.put_item(Item={
            **user_rating_key,
            'rating': rating,
            'created_at': datetime.now().isoformat(),
        })

        # Update stats
        table.update_item(
            Key={
                'pk': f'ARTICLE#{article_id}',
                'sk': 'RATING_STATS'
            },
            UpdateExpression='SET total_ratings = if_not_exists(total_ratings, :zero) + :one, sum_ratings = if_not_exists(sum_ratings, :zero) + :rating',
            ExpressionAttributeValues={
                ':one': 1,
                ':zero': 0,
                ':rating': Decimal(str(rating))
            }
        )

        return {
            'success': True,
            'rating': rating,
            'stats': get_rating_stats(article_id)
        }

    except Exception as e:
        logger.error(f"Error submitting rating: {e}")
        raise


# =============================================================================
# Comments
# =============================================================================

def get_comments(article_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get comments for an article"""
    table = get_engagement_table()

    try:
        response = table.query(
            KeyConditionExpression='pk = :pk AND begins_with(sk, :sk_prefix)',
            ExpressionAttributeValues={
                ':pk': f'ARTICLE#{article_id}',
                ':sk_prefix': 'COMMENT#'
            },
            ScanIndexForward=False,  # Newest first
            Limit=limit
        )

        comments = []
        for item in response.get('Items', []):
            comments.append({
                'id': item.get('comment_id'),
                'text': item.get('text'),
                'mbti_group': item.get('mbti_group'),
                'likes': int(item.get('likes', 0)),
                'created_at': item.get('created_at'),
            })

        return comments

    except Exception as e:
        logger.error(f"Error getting comments: {e}")
        return []


def add_comment(article_id: str, text: str, mbti_group: str, user_id: str) -> Dict[str, Any]:
    """Add a comment to an article"""
    table = get_engagement_table()

    if not text or len(text.strip()) < 2:
        raise ValueError("Comment text is too short")

    if len(text) > 500:
        raise ValueError("Comment text is too long (max 500 characters)")

    if mbti_group not in MBTI_GROUPS:
        mbti_group = 'SF'  # Default

    comment_id = str(uuid.uuid4())[:8]
    timestamp = datetime.now().isoformat()

    try:
        # Save comment
        table.put_item(Item={
            'pk': f'ARTICLE#{article_id}',
            'sk': f'COMMENT#{timestamp}#{comment_id}',
            'comment_id': comment_id,
            'text': text.strip(),
            'mbti_group': mbti_group,
            'user_id': user_id,
            'likes': 0,
            'created_at': timestamp,
        })

        return {
            'success': True,
            'comment': {
                'id': comment_id,
                'text': text.strip(),
                'mbti_group': mbti_group,
                'likes': 0,
                'created_at': timestamp,
            }
        }

    except Exception as e:
        logger.error(f"Error adding comment: {e}")
        raise


def like_comment(article_id: str, comment_id: str, user_id: str) -> Dict[str, Any]:
    """Like/unlike a comment"""
    table = get_engagement_table()

    user_like_key = {
        'pk': f'ARTICLE#{article_id}',
        'sk': f'COMMENT_LIKE#{comment_id}#{user_id}'
    }

    try:
        # Check if already liked
        response = table.get_item(Key=user_like_key)
        already_liked = 'Item' in response

        # Find the comment to update
        comments_response = table.query(
            KeyConditionExpression='pk = :pk AND begins_with(sk, :sk_prefix)',
            FilterExpression='comment_id = :cid',
            ExpressionAttributeValues={
                ':pk': f'ARTICLE#{article_id}',
                ':sk_prefix': 'COMMENT#',
                ':cid': comment_id
            }
        )

        if not comments_response.get('Items'):
            raise ValueError("Comment not found")

        comment_item = comments_response['Items'][0]
        comment_sk = comment_item['sk']

        if already_liked:
            # Unlike
            table.delete_item(Key=user_like_key)
            table.update_item(
                Key={'pk': f'ARTICLE#{article_id}', 'sk': comment_sk},
                UpdateExpression='SET #likes = if_not_exists(#likes, :zero) - :one',
                ExpressionAttributeNames={'#likes': 'likes'},
                ExpressionAttributeValues={':one': 1, ':zero': 0}
            )
            action = 'unliked'
        else:
            # Like
            table.put_item(Item={
                **user_like_key,
                'created_at': datetime.now().isoformat()
            })
            table.update_item(
                Key={'pk': f'ARTICLE#{article_id}', 'sk': comment_sk},
                UpdateExpression='SET #likes = if_not_exists(#likes, :zero) + :one',
                ExpressionAttributeNames={'#likes': 'likes'},
                ExpressionAttributeValues={':one': 1, ':zero': 0}
            )
            action = 'liked'

        # Get updated likes count
        updated = table.get_item(Key={'pk': f'ARTICLE#{article_id}', 'sk': comment_sk})
        new_likes = int(updated.get('Item', {}).get('likes', 0))

        return {
            'action': action,
            'likes': new_likes
        }

    except Exception as e:
        logger.error(f"Error liking comment: {e}")
        raise


# =============================================================================
# Lambda Handler
# =============================================================================

def lambda_handler(event: dict, context) -> dict:
    """
    Lambda handler for engagement API.

    Routes:
    - GET /api/engagement/{articleId} - Get all engagement data
    - POST /api/engagement/{articleId}/reaction - Toggle reaction
    - POST /api/engagement/{articleId}/rating - Submit rating
    - GET /api/engagement/{articleId}/comments - Get comments
    - POST /api/engagement/{articleId}/comments - Add comment
    - POST /api/engagement/{articleId}/comments/{commentId}/like - Like comment
    """
    try:
        # Support both HTTP API v2 and REST API v1 event formats
        request_context = event.get('requestContext', {})

        # HTTP API v2 format
        if 'http' in request_context:
            http_method = request_context['http'].get('method', 'GET')
            path = request_context['http'].get('path', '')
            source_ip = request_context.get('http', {}).get('sourceIp', 'anonymous')
        else:
            # REST API v1 format
            http_method = event.get('httpMethod', 'GET')
            path = event.get('path', '')
            source_ip = request_context.get('identity', {}).get('sourceIp', 'anonymous')

        # Handle CORS preflight
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': ''
            }

        # Parse path parameters
        path_params = event.get('pathParameters', {}) or {}

        # Parse body (handle base64 encoding for HTTP API v2)
        import base64
        body = event.get('body', '{}')
        is_base64 = event.get('isBase64Encoded', False)

        if body and is_base64:
            body = base64.b64decode(body).decode('utf-8')

        if isinstance(body, str) and body:
            body = json.loads(body)
        elif not body:
            body = {}

        # Extract article ID from path params or body
        article_id = path_params.get('articleId') or body.get('article_id')

        # Generate anonymous user ID
        headers = event.get('headers', {}) or {}
        user_agent = headers.get('user-agent', headers.get('User-Agent', ''))[:50]
        user_id = f"{source_ip}_{hash(user_agent) % 10000}"

        logger.info(f"Engagement request: {http_method} {path} article={article_id}")

        # Route handling
        if '/reaction' in path and http_method == 'POST':
            # Toggle reaction
            reaction_type = body.get('reaction_type')
            if not reaction_type:
                return error_response(400, 'reaction_type is required')

            result = toggle_reaction(article_id, reaction_type, user_id)
            return success_response(result)

        elif '/rating' in path and http_method == 'POST':
            # Submit rating
            rating = body.get('rating')
            if not rating:
                return error_response(400, 'rating is required')

            result = submit_rating(article_id, user_id, int(rating))
            return success_response(result)

        elif '/comments' in path:
            if '/like' in path and http_method == 'POST':
                # Like comment
                comment_id = body.get('comment_id')
                if not comment_id:
                    return error_response(400, 'comment_id is required')

                result = like_comment(article_id, comment_id, user_id)
                return success_response(result)

            elif http_method == 'POST':
                # Add comment
                text = body.get('text')
                mbti_group = body.get('mbti_group', 'SF')

                if not text:
                    return error_response(400, 'text is required')

                result = add_comment(article_id, text, mbti_group, user_id)
                return success_response(result)

            else:
                # Get comments
                comments = get_comments(article_id)
                return success_response({'comments': comments})

        else:
            # Get all engagement data
            if not article_id:
                return error_response(400, 'article_id is required')

            reactions = get_reactions(article_id)
            rating_stats = get_rating_stats(article_id)
            comments = get_comments(article_id, limit=20)

            return success_response({
                'article_id': article_id,
                'reactions': reactions,
                'rating': rating_stats,
                'comments': comments,
            })

    except ValueError as e:
        return error_response(400, str(e))

    except Exception as e:
        logger.error(f"Engagement error: {e}", exc_info=True)
        return error_response(500, '서버 오류가 발생했습니다.')


def success_response(data: dict) -> dict:
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(decimal_to_float(data), ensure_ascii=False)
    }


def error_response(status_code: int, message: str) -> dict:
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'error': {
                'code': 'ENGAGEMENT_ERROR',
                'message': message
            }
        }, ensure_ascii=False)
    }
