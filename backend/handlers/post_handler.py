"""
PostHandler Lambda Function
Handles user post CRUD operations.

Admin (ai@sedaily.com) can create, update, delete posts.
Posts are stored in the same DynamoDB table as articles with item_type='user_post'.
"""
import json
import logging
import uuid
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# Korea Standard Time (UTC+9)
KST = timezone(timedelta(hours=9))

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Admin email for authorization
ADMIN_EMAIL = "ai@sedaily.com"

# DynamoDB table name
TABLE_NAME = "sedaily-mbti-articles-dev"


def _sanitize_for_dynamodb(obj):
    """Recursively convert float values to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: _sanitize_for_dynamodb(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_dynamodb(v) for v in obj]
    return obj


def _decimal_to_float(obj):
    """Recursively convert Decimal values to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_decimal_to_float(v) for v in obj]
    return obj


@dataclass
class UserPost:
    """User post data structure (compatible with Article)"""
    news_id: str
    item_type: str = "user_post"
    title_ko: str = ""
    content_ko: str = ""
    category: str = ""
    author: str = ""
    author_name: str = ""
    author_email: str = ""
    byline: str = ""
    images: List[str] = None
    published_at: str = ""
    created_at: str = ""
    updated_at: str = ""
    # MBTI versions (same content for all)
    version_NT: Dict[str, Any] = None
    version_NF: Dict[str, Any] = None
    version_ST: Dict[str, Any] = None
    version_SF: Dict[str, Any] = None

    def __post_init__(self):
        if self.images is None:
            self.images = []
        # Create MBTI versions with same content
        version_data = {
            "title": self.title_ko,
            "subtitle": "",
            "body": [self.content_ko],
            "key_points": [],
            "closing_line": "",
            "tone": "informative"
        }
        if self.version_NT is None:
            self.version_NT = version_data.copy()
        if self.version_NF is None:
            self.version_NF = version_data.copy()
        if self.version_ST is None:
            self.version_ST = version_data.copy()
        if self.version_SF is None:
            self.version_SF = version_data.copy()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for DynamoDB storage"""
        data = asdict(self)
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}
        return data


class PostHandler:
    """Handles user post CRUD operations"""

    def __init__(self, region: str = "us-east-1"):
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table = self.dynamodb.Table(TABLE_NAME)

    def _generate_post_id(self) -> str:
        """Generate unique post ID"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"post_{timestamp}_{unique_id}"

    def _is_admin(self, user_email: str) -> bool:
        """Check if user is admin"""
        return user_email == ADMIN_EMAIL

    def create_post(
        self,
        title: str,
        content: str,
        category: str,
        author_id: str,
        author_name: str,
        author_email: str,
        image_url: Optional[str] = None,
        version_NT: Optional[Dict[str, str]] = None,
        version_NF: Optional[Dict[str, str]] = None,
        version_ST: Optional[Dict[str, str]] = None,
        version_SF: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create a new user post

        Args:
            title: Post title (default, used if no MBTI versions)
            content: Post content (default, used if no MBTI versions)
            category: Category (경제, 정치, 사회, 세계, 테크, 문화)
            author_id: Author user ID
            author_name: Author display name
            author_email: Author email (must be admin)
            image_url: Optional image URL
            version_NT: MBTI NT version {title, body}
            version_NF: MBTI NF version {title, body}
            version_ST: MBTI ST version {title, body}
            version_SF: MBTI SF version {title, body}

        Returns:
            Created post data

        Raises:
            PermissionError: If user is not admin
        """
        if not self._is_admin(author_email):
            raise PermissionError("Only admin can create posts")

        # Use KST timezone to match article timestamps format
        now = datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S+09:00")
        post_id = self._generate_post_id()

        images = [image_url] if image_url else []

        # Build MBTI versions from input or use default content
        def build_version(v: Optional[Dict[str, str]], default_title: str, default_body: str) -> Dict[str, Any]:
            if v and v.get("title") and v.get("body"):
                return {
                    "title": v["title"],
                    "subtitle": "",
                    "body": [v["body"]],
                    "key_points": [],
                    "closing_line": "",
                    "tone": "informative"
                }
            return {
                "title": default_title,
                "subtitle": "",
                "body": [default_body],
                "key_points": [],
                "closing_line": "",
                "tone": "informative"
            }

        post = UserPost(
            news_id=post_id,
            title_ko=title,
            content_ko=content,
            category=category,
            author=author_id,
            author_name=author_name,
            author_email=author_email,
            byline=author_name,
            images=images,
            published_at=now,
            created_at=now,
            updated_at=now,
            version_NT=build_version(version_NT, title, content),
            version_NF=build_version(version_NF, title, content),
            version_ST=build_version(version_ST, title, content),
            version_SF=build_version(version_SF, title, content),
        )

        # Save to DynamoDB
        item = _sanitize_for_dynamodb(post.to_dict())
        self.table.put_item(Item=item)

        logger.info(f"Created post {post_id} by {author_email}")
        return post.to_dict()

    def get_post(self, post_id: str) -> Optional[Dict[str, Any]]:
        """Get a post by ID"""
        try:
            response = self.table.get_item(Key={'news_id': post_id})
            item = response.get('Item')
            if item and item.get('item_type') == 'user_post':
                return _decimal_to_float(item)
            return None
        except Exception as e:
            logger.error(f"Error getting post {post_id}: {e}")
            return None

    def list_posts(
        self,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        List user posts

        Args:
            category: Optional category filter
            limit: Maximum number of posts to return

        Returns:
            List of posts
        """
        try:
            # Scan for user_post items with pagination
            # Note: In production, consider using GSI for better performance
            filter_expr = boto3.dynamodb.conditions.Attr('item_type').eq('user_post')

            if category and category != "전체":
                filter_expr = filter_expr & boto3.dynamodb.conditions.Attr('category').eq(category)

            scan_kwargs = {
                'FilterExpression': filter_expr
            }

            items = []
            # Paginate through all results
            while True:
                response = self.table.scan(**scan_kwargs)
                items.extend(response.get('Items', []))

                # Stop if we have enough or no more pages
                if len(items) >= limit or 'LastEvaluatedKey' not in response:
                    break

                scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']

            # Sort by published_at descending
            items.sort(key=lambda x: x.get('published_at', ''), reverse=True)

            # Apply limit
            items = items[:limit]

            logger.info(f"list_posts: Found {len(items)} posts")
            return [_decimal_to_float(item) for item in items]

        except Exception as e:
            logger.error(f"Error listing posts: {e}")
            return []

    def delete_post(self, post_id: str, user_email: str) -> bool:
        """
        Delete a post

        Args:
            post_id: Post ID to delete
            user_email: User email (must be admin)

        Returns:
            True if deleted successfully

        Raises:
            PermissionError: If user is not admin
        """
        if not self._is_admin(user_email):
            raise PermissionError("Only admin can delete posts")

        try:
            # Verify it's a user_post before deleting
            existing = self.get_post(post_id)
            if not existing:
                logger.warning(f"Post {post_id} not found")
                return False

            self.table.delete_item(Key={'news_id': post_id})
            logger.info(f"Deleted post {post_id} by {user_email}")
            return True

        except Exception as e:
            logger.error(f"Error deleting post {post_id}: {e}")
            return False


def _cors_response(status_code: int, body: dict) -> dict:
    """Create API Gateway response with CORS headers"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
        "body": json.dumps(body, ensure_ascii=False)
    }


def lambda_handler(event: dict, context) -> dict:
    """
    AWS Lambda handler for post operations

    Routes:
        POST /api/posts - Create post
        GET /api/posts - List posts
        GET /api/posts/{post_id} - Get single post
        DELETE /api/posts/{post_id} - Delete post
        OPTIONS /api/posts - CORS preflight
    """
    try:
        # Lambda Warming - Detect CloudWatch Events warmup trigger
        if event.get("source") == "aws.events" or event.get("warmup") == True:
            logger.info("Lambda warmup ping received - keeping container warm")
            return _cors_response(200, {"status": "warm", "message": "Lambda is warm"})

        # Support both REST API (v1) and HTTP API (v2) event formats
        request_context = event.get("requestContext", {})
        if "http" in request_context:
            # HTTP API v2 format
            http_method = request_context["http"].get("method", "GET")
            path = request_context["http"].get("path", "")
        else:
            # REST API v1 format
            http_method = event.get("httpMethod", "GET")
            path = event.get("path", "")

        path_parameters = event.get("pathParameters") or {}
        query_parameters = event.get("queryStringParameters") or {}

        logger.info(f"Post handler: method={http_method}, path={path}, params={path_parameters}")

        # Handle CORS preflight
        if http_method == "OPTIONS":
            return _cors_response(200, {"message": "OK"})

        handler = PostHandler()
        post_id = path_parameters.get("post_id")

        # GET /api/posts/{post_id} - Get single post
        if http_method == "GET" and post_id:
            post = handler.get_post(post_id)
            if post:
                return _cors_response(200, post)
            return _cors_response(404, {"error": "Post not found"})

        # GET /api/posts - List posts
        if http_method == "GET":
            category = query_parameters.get("category")
            limit = int(query_parameters.get("limit", "50"))
            posts = handler.list_posts(category=category, limit=limit)
            return _cors_response(200, {"posts": posts, "count": len(posts)})

        # POST /api/posts - Create post
        if http_method == "POST":
            body = json.loads(event.get("body", "{}"))

            title = body.get("title", "").strip()
            content = body.get("content", "").strip()
            category = body.get("category", "경제")
            author_id = body.get("author_id", "")
            author_name = body.get("author_name", "")
            author_email = body.get("author_email", "")
            image_url = body.get("image_url")

            # MBTI versions (optional)
            version_NT = body.get("version_NT")
            version_NF = body.get("version_NF")
            version_ST = body.get("version_ST")
            version_SF = body.get("version_SF")

            # Validation
            if not title:
                return _cors_response(400, {"error": "Title is required"})
            if not content:
                return _cors_response(400, {"error": "Content is required"})
            if not author_email:
                return _cors_response(400, {"error": "Author email is required"})

            try:
                post = handler.create_post(
                    title=title,
                    content=content,
                    category=category,
                    author_id=author_id,
                    author_name=author_name,
                    author_email=author_email,
                    image_url=image_url,
                    version_NT=version_NT,
                    version_NF=version_NF,
                    version_ST=version_ST,
                    version_SF=version_SF
                )
                return _cors_response(201, post)
            except PermissionError as e:
                return _cors_response(403, {"error": str(e)})

        # DELETE /api/posts/{post_id} - Delete post
        if http_method == "DELETE" and post_id:
            body = json.loads(event.get("body", "{}"))
            user_email = body.get("user_email", "")

            if not user_email:
                # Try to get from query params or headers
                user_email = query_parameters.get("user_email", "")

            try:
                success = handler.delete_post(post_id, user_email)
                if success:
                    return _cors_response(200, {"message": "Post deleted"})
                return _cors_response(404, {"error": "Post not found"})
            except PermissionError as e:
                return _cors_response(403, {"error": str(e)})

        # Method not allowed
        return _cors_response(405, {"error": "Method not allowed"})

    except json.JSONDecodeError:
        return _cors_response(400, {"error": "Invalid JSON body"})
    except Exception as e:
        logger.error(f"Lambda handler error: {e}", exc_info=True)
        return _cors_response(500, {"error": "Internal server error"})
