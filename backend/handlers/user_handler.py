"""
User Activity Handler Lambda Function
Handles user profile, reading history, and statistics.
"""
import logging
import boto3
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional

from config.constants import CORS_HEADERS, MBTI_GROUPS

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
ENGAGEMENT_TABLE = 'sedaily-mbti-engagement-dev'


def get_table():
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
# User Profile
# =============================================================================

def get_or_create_user(user_id: str, email: str = None, name: str = None, picture: str = None, mbti_group: str = 'SF') -> Dict[str, Any]:
    """Get or create user profile"""
    table = get_table()

    try:
        response = table.get_item(
            Key={
                'pk': f'USER#{user_id}',
                'sk': 'PROFILE'
            }
        )

        if 'Item' in response:
            # Existing user - update last login
            user = response['Item']
            today = datetime.now().strftime('%Y-%m-%d')

            # Update last login date
            table.update_item(
                Key={'pk': f'USER#{user_id}', 'sk': 'PROFILE'},
                UpdateExpression='SET last_login = :today',
                ExpressionAttributeValues={':today': today}
            )

            # Record daily visit
            record_daily_visit(user_id, today)

            # Calculate streak
            streak = calculate_streak(user_id)

            return {
                'user_id': user_id,
                'email': user.get('email'),
                'name': user.get('name'),
                'picture': user.get('picture'),
                'mbti_group': user.get('mbti_group', 'SF'),
                'created_at': user.get('created_at'),
                'last_login': today,
                'streak': streak,
                'is_new': False
            }
        else:
            # New user
            today = datetime.now().strftime('%Y-%m-%d')
            now = datetime.now().isoformat()

            user_data = {
                'pk': f'USER#{user_id}',
                'sk': 'PROFILE',
                'user_id': user_id,
                'email': email,
                'name': name,
                'picture': picture,
                'mbti_group': mbti_group if mbti_group in MBTI_GROUPS else 'SF',
                'created_at': now,
                'last_login': today,
            }

            table.put_item(Item=user_data)

            # Initialize stats
            table.put_item(Item={
                'pk': f'USER#{user_id}',
                'sk': 'STATS',
                'total_articles_read': 0,
                'total_comments': 0,
                'total_reactions': 0,
                'badges': [],
            })

            # Record first daily visit
            record_daily_visit(user_id, today)

            return {
                'user_id': user_id,
                'email': email,
                'name': name,
                'picture': picture,
                'mbti_group': mbti_group,
                'created_at': now,
                'last_login': today,
                'streak': 1,
                'is_new': True
            }

    except Exception as e:
        logger.error(f"Error in get_or_create_user: {e}")
        raise


def update_user_mbti(user_id: str, mbti_group: str) -> Dict[str, Any]:
    """Update user's MBTI group"""
    table = get_table()

    if mbti_group not in MBTI_GROUPS:
        raise ValueError(f"Invalid MBTI group: {mbti_group}")

    try:
        table.update_item(
            Key={'pk': f'USER#{user_id}', 'sk': 'PROFILE'},
            UpdateExpression='SET mbti_group = :mbti',
            ExpressionAttributeValues={':mbti': mbti_group}
        )

        return {'success': True, 'mbti_group': mbti_group}

    except Exception as e:
        logger.error(f"Error updating MBTI: {e}")
        raise


# =============================================================================
# Daily Visit & Streak
# =============================================================================

def record_daily_visit(user_id: str, date: str):
    """Record a daily visit"""
    table = get_table()

    try:
        table.put_item(
            Item={
                'pk': f'USER#{user_id}',
                'sk': f'DAILY#{date}',
                'date': date,
                'visited_at': datetime.now().isoformat()
            },
            ConditionExpression='attribute_not_exists(pk)'
        )
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        # Already recorded today
        pass
    except Exception as e:
        logger.error(f"Error recording daily visit: {e}")


def calculate_streak(user_id: str) -> int:
    """Calculate consecutive days streak"""
    table = get_table()

    try:
        # Get last 30 days of visits
        today = datetime.now()
        dates_to_check = [(today - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(30)]

        response = table.query(
            KeyConditionExpression='pk = :pk AND begins_with(sk, :sk_prefix)',
            ExpressionAttributeValues={
                ':pk': f'USER#{user_id}',
                ':sk_prefix': 'DAILY#'
            },
            ScanIndexForward=False,
            Limit=30
        )

        visited_dates = set()
        for item in response.get('Items', []):
            visited_dates.add(item.get('date'))

        # Count consecutive days starting from today
        streak = 0
        for date in dates_to_check:
            if date in visited_dates:
                streak += 1
            else:
                break

        return streak

    except Exception as e:
        logger.error(f"Error calculating streak: {e}")
        return 0


# =============================================================================
# Reading History
# =============================================================================

def record_article_read(user_id: str, article_id: str, article_title: str = None) -> Dict[str, Any]:
    """Record that user read an article"""
    table = get_table()
    today = datetime.now().strftime('%Y-%m-%d')
    now = datetime.now().isoformat()

    try:
        # Check if already read
        response = table.get_item(
            Key={
                'pk': f'USER#{user_id}',
                'sk': f'READ#{article_id}'
            }
        )

        if 'Item' in response:
            # Already read - just update read count
            table.update_item(
                Key={'pk': f'USER#{user_id}', 'sk': f'READ#{article_id}'},
                UpdateExpression='SET read_count = if_not_exists(read_count, :zero) + :one, last_read = :now',
                ExpressionAttributeValues={
                    ':one': 1,
                    ':zero': 0,
                    ':now': now
                }
            )
            return {'success': True, 'is_new': False}

        # New read
        table.put_item(Item={
            'pk': f'USER#{user_id}',
            'sk': f'READ#{article_id}',
            'article_id': article_id,
            'article_title': article_title,
            'first_read': now,
            'last_read': now,
            'read_count': 1,
            'read_date': today
        })

        # Update total articles read
        table.update_item(
            Key={'pk': f'USER#{user_id}', 'sk': 'STATS'},
            UpdateExpression='SET total_articles_read = if_not_exists(total_articles_read, :zero) + :one',
            ExpressionAttributeValues={
                ':one': 1,
                ':zero': 0
            }
        )

        # Check for badges
        check_and_award_badges(user_id)

        return {'success': True, 'is_new': True}

    except Exception as e:
        logger.error(f"Error recording article read: {e}")
        raise


def get_reading_history(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Get user's reading history"""
    table = get_table()

    try:
        response = table.query(
            KeyConditionExpression='pk = :pk AND begins_with(sk, :sk_prefix)',
            ExpressionAttributeValues={
                ':pk': f'USER#{user_id}',
                ':sk_prefix': 'READ#'
            },
            ScanIndexForward=False,
            Limit=limit
        )

        history = []
        for item in response.get('Items', []):
            history.append({
                'article_id': item.get('article_id'),
                'article_title': item.get('article_title'),
                'first_read': item.get('first_read'),
                'last_read': item.get('last_read'),
                'read_count': int(item.get('read_count', 1))
            })

        return history

    except Exception as e:
        logger.error(f"Error getting reading history: {e}")
        return []


# =============================================================================
# Statistics & Badges
# =============================================================================

def get_user_stats(user_id: str) -> Dict[str, Any]:
    """Get user statistics"""
    table = get_table()

    try:
        # Get stats
        stats_response = table.get_item(
            Key={'pk': f'USER#{user_id}', 'sk': 'STATS'}
        )
        stats = stats_response.get('Item', {})

        # Get profile for streak
        profile_response = table.get_item(
            Key={'pk': f'USER#{user_id}', 'sk': 'PROFILE'}
        )
        profile = profile_response.get('Item', {})

        # Calculate streak
        streak = calculate_streak(user_id)

        # Get this week's reading count
        today = datetime.now()
        week_start = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')

        week_response = table.query(
            KeyConditionExpression='pk = :pk AND begins_with(sk, :sk_prefix)',
            FilterExpression='read_date >= :week_start',
            ExpressionAttributeValues={
                ':pk': f'USER#{user_id}',
                ':sk_prefix': 'READ#',
                ':week_start': week_start
            }
        )
        this_week_count = len(week_response.get('Items', []))

        return {
            'total_articles_read': int(stats.get('total_articles_read', 0)),
            'total_comments': int(stats.get('total_comments', 0)),
            'total_reactions': int(stats.get('total_reactions', 0)),
            'streak': streak,
            'this_week_articles': this_week_count,
            'badges': stats.get('badges', []),
            'member_since': profile.get('created_at', '')[:10] if profile.get('created_at') else None
        }

    except Exception as e:
        logger.error(f"Error getting user stats: {e}")
        return {
            'total_articles_read': 0,
            'total_comments': 0,
            'total_reactions': 0,
            'streak': 0,
            'this_week_articles': 0,
            'badges': [],
            'member_since': None
        }


def check_and_award_badges(user_id: str):
    """Check and award badges based on achievements"""
    table = get_table()

    try:
        stats = get_user_stats(user_id)
        existing_badges = set(stats.get('badges', []))
        new_badges = []

        # Badge definitions
        badge_rules = [
            ('first_login', '첫 방문', lambda s: True),
            ('reader_10', '10개 기사 읽기', lambda s: s['total_articles_read'] >= 10),
            ('reader_50', '50개 기사 읽기', lambda s: s['total_articles_read'] >= 50),
            ('reader_100', '100개 기사 읽기', lambda s: s['total_articles_read'] >= 100),
            ('streak_7', '7일 연속 접속', lambda s: s['streak'] >= 7),
            ('streak_30', '30일 연속 접속', lambda s: s['streak'] >= 30),
            ('weekly_5', '이번 주 5개 읽기', lambda s: s['this_week_articles'] >= 5),
        ]

        for badge_id, badge_name, condition in badge_rules:
            if badge_id not in existing_badges and condition(stats):
                new_badges.append({
                    'id': badge_id,
                    'name': badge_name,
                    'earned_at': datetime.now().isoformat()
                })

        if new_badges:
            # Update badges
            all_badges = list(existing_badges) + [b['id'] for b in new_badges]
            table.update_item(
                Key={'pk': f'USER#{user_id}', 'sk': 'STATS'},
                UpdateExpression='SET badges = :badges',
                ExpressionAttributeValues={':badges': all_badges}
            )

        return new_badges

    except Exception as e:
        logger.error(f"Error checking badges: {e}")
        return []


# =============================================================================
# Lambda Handler
# =============================================================================

def lambda_handler(event: dict, context) -> dict:
    """
    Lambda handler for user API.

    Routes:
    - POST /api/user/profile - Get or create user profile (requires auth)
    - PUT /api/user/mbti - Update MBTI group
    - POST /api/user/read - Record article read
    - GET /api/user/history - Get reading history
    - GET /api/user/stats - Get user statistics
    """
    try:
        # Parse request
        request_context = event.get('requestContext', {})

        if 'http' in request_context:
            http_method = request_context['http'].get('method', 'GET')
            path = request_context['http'].get('path', '')
        else:
            http_method = event.get('httpMethod', 'GET')
            path = event.get('path', '')

        # Handle CORS preflight
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': ''
            }

        # Parse body
        import base64
        body = event.get('body', '{}')
        is_base64 = event.get('isBase64Encoded', False)

        if body and is_base64:
            body = base64.b64decode(body).decode('utf-8')

        if isinstance(body, str) and body:
            body = json.loads(body)
        elif not body:
            body = {}

        # Get user_id from body, query params, or headers
        query_params = event.get('queryStringParameters', {}) or {}
        user_id = body.get('user_id') or query_params.get('user_id')

        if not user_id:
            return error_response(400, 'user_id is required')

        logger.info(f"User request: {http_method} {path} user={user_id}")

        # Route handling
        if '/profile' in path:
            if http_method == 'POST':
                # Get or create profile
                email = body.get('email')
                name = body.get('name')
                picture = body.get('picture')
                mbti_group = body.get('mbti_group', 'SF')

                result = get_or_create_user(user_id, email, name, picture, mbti_group)
                return success_response(result)

        elif '/mbti' in path and http_method == 'PUT':
            # Update MBTI
            mbti_group = body.get('mbti_group')
            if not mbti_group:
                return error_response(400, 'mbti_group is required')

            result = update_user_mbti(user_id, mbti_group)
            return success_response(result)

        elif '/read' in path and http_method == 'POST':
            # Record article read
            article_id = body.get('article_id')
            article_title = body.get('article_title')

            if not article_id:
                return error_response(400, 'article_id is required')

            result = record_article_read(user_id, article_id, article_title)
            return success_response(result)

        elif '/history' in path and http_method == 'GET':
            # Get reading history
            history = get_reading_history(user_id)
            return success_response({'history': history})

        elif '/stats' in path:
            # Get stats
            stats = get_user_stats(user_id)
            return success_response(stats)

        else:
            return error_response(404, 'Not found')

    except ValueError as e:
        return error_response(400, str(e))

    except Exception as e:
        logger.error(f"User handler error: {e}", exc_info=True)
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
                'code': 'USER_ERROR',
                'message': message
            }
        }, ensure_ascii=False)
    }
