from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
import time
import urllib.parse
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, cast, String, func

app = Flask(__name__)
CORS(app)


def get_db_uri():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        if database_url.startswith("mysql://"):
            return database_url.replace("mysql://", "mysql+pymysql://", 1)
        return database_url

    mysql_public_url = os.getenv("MYSQL_PUBLIC_URL", "").strip()
    if mysql_public_url:
        if mysql_public_url.startswith("mysql://"):
            return mysql_public_url.replace("mysql://", "mysql+pymysql://", 1)
        return mysql_public_url

    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "3306")
    name = os.getenv("DB_NAME", "student_retention")
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "Sakthi@2005$")
    quoted_password = urllib.parse.quote_plus(password)
    return f"mysql+pymysql://{user}:{quoted_password}@{host}:{port}/{name}"


def get_db_source_label():
    if os.getenv("DATABASE_URL", "").strip():
        return "DATABASE_URL"
    if os.getenv("MYSQL_PUBLIC_URL", "").strip():
        return "MYSQL_PUBLIC_URL"
    return "DB_*"


app.config["SQLALCHEMY_DATABASE_URI"] = get_db_uri()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "pool_recycle": 280,
    "connect_args": {
        "connect_timeout": 20,
        "read_timeout": 60,
        "write_timeout": 60,
    },
}

db = SQLAlchemy(app)
RETENTION_ALERT_THRESHOLD = float(os.getenv("RETENTION_ALERT_THRESHOLD", "50"))


def initialize_database(retries=3, delay=3, fail_fast=False):
    for attempt in range(1, retries + 1):
        try:
            with app.app_context():
                db.create_all()
            print("Database initialization completed.", flush=True)
            return True
        except Exception as exc:
            print(
                f"Database initialization failed "
                f"(attempt {attempt}/{retries}): {exc}",
                flush=True,
            )
            db.session.remove()
            if attempt < retries:
                time.sleep(delay)

    if fail_fast:
        raise RuntimeError("Database initialization failed after retries.")
    return False


class RetentionRecord(db.Model):
    __tablename__ = "retention_data"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, nullable=False)
    student_name = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(120), nullable=False)
    initial_score = db.Column(db.Float, nullable=False)
    final_score = db.Column(db.Float, nullable=False)
    decay = db.Column(db.Float, nullable=False)
    retention = db.Column(db.Float, nullable=False)
    retention_level = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (db.UniqueConstraint("student_id", "subject", name="uq_student_course"),)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


def is_password_valid(password):
    return (
        len(password) >= 8
        and any(c.isupper() for c in password)
        and any(c.isdigit() for c in password)
        and any(not c.isalnum() for c in password)
    )


def classify_retention(retention):
    if retention >= 80:
        return "High"
    if retention >= 50:
        return "Medium"
    return "Low"


def needs_intervention(retention):
    return retention < RETENTION_ALERT_THRESHOLD


@app.route("/")
def home():
    return "Flask is running"


@app.route("/health/db", methods=["GET"])
def health_db():
    try:
        user_count = User.query.count()
        record_count = RetentionRecord.query.count()
        return jsonify(
            {
                "status": "ok",
                "db_source": get_db_source_label(),
                "users_count": user_count,
                "retention_records_count": record_count,
            }
        )
    except Exception as exc:
        return (
            jsonify(
                {
                    "status": "error",
                    "db_source": get_db_source_label(),
                    "message": str(exc),
                }
            ),
            500,
        )


@app.route("/init-db", methods=["GET", "POST"])
def init_db():
    initialized = initialize_database(retries=5, delay=2)
    status = "ok" if initialized else "error"
    return jsonify({"status": status, "db_source": get_db_source_label()}), (
        200 if initialized else 500
    )


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}

    student_id = data.get("student_id", None)
    name = str(data.get("name", "")).strip()
    subject = str(data.get("subject", "")).strip()
    initial = data.get("initial", None)
    final = data.get("final", None)

    if student_id is None:
        return jsonify({"error": "Student ID is required."}), 400
    if not name or not subject:
        return jsonify({"error": "Name and course are required."}), 400

    try:
        student_id = int(student_id)
        initial = float(initial)
        final = float(final)
    except (TypeError, ValueError):
        return jsonify({"error": "Student ID and scores must be numbers."}), 400

    if initial < 1 or initial > 100:
        return jsonify({"error": "Previous exam mark must be between 1 and 100."}), 400
    if final < 1 or final > 100:
        return jsonify({"error": "Current exam mark must be between 1 and 100."}), 400

    if final > initial:
        decay = 0
        gained = ((final - initial) / initial) * 100
        lost_pct = 0.0
        retention = 100.0
    else:
        decay = initial - final
        gained = 0
        lost_pct = ((initial - final) / initial) * 100
        retention = (final / initial) * 100
    retention_level = classify_retention(retention)

    existing_record = RetentionRecord.query.filter_by(student_id=student_id, subject=subject).first()
    if existing_record:
        if existing_record.student_name.strip().lower() != name.strip().lower():
            return jsonify({"error": "Student ID already exists with a different name."}), 409
        # For repeat entries of the same student + course, carry forward the last current mark
        initial = existing_record.final_score
        if initial < 1 or initial > 100:
            return jsonify({"error": "Previous exam mark must be between 1 and 100."}), 400
        if final < 1 or final > 100:
            return jsonify({"error": "Current exam mark must be between 1 and 100."}), 400

        if final > initial:
            decay = 0
            gained = ((final - initial) / initial) * 100
            lost_pct = 0.0
            retention = 100.0
        else:
            decay = initial - final
            gained = 0
            lost_pct = ((initial - final) / initial) * 100
            retention = (final / initial) * 100
        retention_level = classify_retention(retention)

        existing_record.student_name = name
        existing_record.subject = subject
        existing_record.initial_score = initial
        existing_record.final_score = final
        existing_record.decay = decay
        existing_record.retention = retention
        existing_record.retention_level = retention_level
        record = existing_record
    else:
        record = RetentionRecord(
            student_id=student_id,
            student_name=name,
            subject=subject,
            initial_score=initial,
            final_score=final,
            decay=decay,
            retention=retention,
            retention_level=retention_level,
        )
        db.session.add(record)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Student ID and course already exist. Enter different course or update marks."}), 409

    return jsonify(
        {
            "id": record.id,
            "student_id": record.student_id,
            "name": record.student_name,
            "subject": record.subject,
            "initial": record.initial_score,
            "final": record.final_score,
            "decay": record.decay,
            "retention": record.retention,
            "retention_level": record.retention_level,
            "gained": gained,
            "lost_pct": lost_pct,
            "needs_intervention": needs_intervention(record.retention),
            "intervention_message": "Needs intervention" if needs_intervention(record.retention) else "",
            "intervention_threshold": RETENTION_ALERT_THRESHOLD,
        }
    )


@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400
    if not is_password_valid(password):
        return (
            jsonify(
                {
                    "error": "Password must be at least 8 characters and include one uppercase letter, one number, and one special character."
                }
            ),
            400,
        )

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "Email already registered."}), 409

    password_hash = generate_password_hash(password)
    user = User(name=name, email=email, password_hash=password_hash)
    db.session.add(user)
    db.session.commit()

    return jsonify({"id": user.id, "name": user.name, "email": user.email}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return (
            jsonify(
                {
                    "error": "Invalid email or password. Password must be at least 8 characters and include one uppercase letter, one number, and one special character."
                }
            ),
            401,
        )

    return jsonify({"id": user.id, "name": user.name, "email": user.email})


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    current_password = str(data.get("current_password", ""))
    new_password = str(data.get("new_password", ""))

    if not email or not current_password or not new_password:
        return jsonify({"error": "Email, current password, and new password are required."}), 400
    if not is_password_valid(new_password):
        return (
            jsonify(
                {
                    "error": "Password must be at least 8 characters and include one uppercase letter, one number, and one special character."
                }
            ),
            400,
        )

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, current_password):
        return jsonify({"error": "You entered incorrect email or current password."}), 401

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()

    return jsonify({"message": "Password reset successful."})


@app.route("/profile/<int:user_id>", methods=["PUT"])
def update_profile(user_id):
    data = request.get_json(silent=True) or {}

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    name = str(data.get("name", user.name)).strip()
    email = str(data.get("email", user.email)).strip().lower()
    current_password = str(data.get("current_password", ""))
    new_password = str(data.get("new_password", ""))

    if not name or not email:
        return jsonify({"error": "Name and email are required."}), 400

    email_owner = User.query.filter_by(email=email).first()
    if email_owner and email_owner.id != user.id:
        return jsonify({"error": "Email already in use."}), 409

    user.name = name
    user.email = email

    if new_password:
        if not current_password:
            return jsonify({"error": "Current password is required to set a new password."}), 400
        if not check_password_hash(user.password_hash, current_password):
            return jsonify({"error": "Current password is incorrect."}), 401
        if not is_password_valid(new_password):
            return (
                jsonify(
                    {
                        "error": "Password must be at least 8 characters and include one uppercase letter, one number, and one special character."
                    }
                ),
                400,
            )
        user.password_hash = generate_password_hash(new_password)

    db.session.commit()
    return jsonify({"id": user.id, "name": user.name, "email": user.email})


@app.route("/records/lookup", methods=["GET"])
def lookup_record():
    student_id = request.args.get("student_id", None)
    subject = str(request.args.get("subject", "")).strip()
    name = str(request.args.get("name", "")).strip()

    if student_id is None or not subject:
        return jsonify({"exists": False}), 200

    try:
        student_id = int(student_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Student ID must be a number."}), 400

    record = RetentionRecord.query.filter_by(student_id=student_id, subject=subject).first()
    if not record:
        return jsonify({"exists": False}), 200

    if name and record.student_name.strip().lower() != name.lower():
        return jsonify({"error": "Student ID already exists with a different name."}), 409

    return jsonify(
        {
            "exists": True,
            "previous_mark": record.final_score,
            "student_name": record.student_name,
            "subject": record.subject,
        }
    )


@app.route("/records", methods=["GET"])
def records():
    course = str(request.args.get("course", "")).strip()
    level = str(request.args.get("level", "")).strip()
    student = str(request.args.get("student", "")).strip()
    from_date = str(request.args.get("from_date", "")).strip()
    to_date = str(request.args.get("to_date", "")).strip()

    query = RetentionRecord.query

    if course:
        query = query.filter(RetentionRecord.subject == course)
    if level:
        query = query.filter(func.lower(RetentionRecord.retention_level) == level.lower())
    if student:
        like_term = f"%{student}%"
        query = query.filter(
            or_(
                RetentionRecord.student_name.ilike(like_term),
                cast(RetentionRecord.student_id, String).ilike(like_term),
            )
        )

    try:
        if from_date:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
            query = query.filter(func.date(RetentionRecord.created_at) >= from_dt)
        if to_date:
            to_dt = datetime.strptime(to_date, "%Y-%m-%d").date()
            query = query.filter(func.date(RetentionRecord.created_at) <= to_dt)
    except ValueError:
        return jsonify({"error": "Date format must be YYYY-MM-DD."}), 400

    rows = query.order_by(RetentionRecord.student_name.asc()).limit(200).all()
    return jsonify(
        [
            {
                "id": r.id,
                "student_id": r.student_id,
                "name": r.student_name,
                "subject": r.subject,
                "initial": r.initial_score,
                "final": r.final_score,
                "decay": r.decay,
                "retention": r.retention,
                "retention_level": r.retention_level,
                "needs_intervention": needs_intervention(r.retention),
                "intervention_message": "Needs intervention" if needs_intervention(r.retention) else "",
                "intervention_threshold": RETENTION_ALERT_THRESHOLD,
                "created_at": r.created_at.isoformat() + "Z",
            }
            for r in rows
        ]
    )


@app.route("/records/<int:record_id>", methods=["PUT", "DELETE"])
def update_or_delete_record(record_id):
    record = RetentionRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Record not found."}), 404

    if request.method == "DELETE":
        db.session.delete(record)
        db.session.commit()
        return jsonify({"message": "Record deleted successfully."})

    data = request.get_json(silent=True) or {}
    initial = data.get("initial", None)
    final = data.get("final", None)

    try:
        initial = float(initial)
        final = float(final)
    except (TypeError, ValueError):
        return jsonify({"error": "Previous and current marks must be numbers."}), 400

    if initial < 1 or initial > 100:
        return jsonify({"error": "Previous exam mark must be between 1 and 100."}), 400
    if final < 1 or final > 100:
        return jsonify({"error": "Current exam mark must be between 1 and 100."}), 400

    if final > initial:
        decay = 0.0
        retention = 100.0
    else:
        decay = initial - final
        retention = (final / initial) * 100

    record.initial_score = initial
    record.final_score = final
    record.decay = decay
    record.retention = retention
    record.retention_level = classify_retention(retention)
    db.session.commit()

    return jsonify(
        {
            "id": record.id,
            "student_id": record.student_id,
            "name": record.student_name,
            "subject": record.subject,
            "initial": record.initial_score,
            "final": record.final_score,
            "decay": record.decay,
            "retention": record.retention,
            "retention_level": record.retention_level,
            "needs_intervention": needs_intervention(record.retention),
            "intervention_message": "Needs intervention" if needs_intervention(record.retention) else "",
            "intervention_threshold": RETENTION_ALERT_THRESHOLD,
        }
    )


@app.route("/dashboard-kpis", methods=["GET"])
def dashboard_kpis():
    rows = RetentionRecord.query.all()
    total_records = len(rows)
    if total_records == 0:
        return jsonify(
            {
                "overall": {
                    "total_records": 0,
                    "average_retention": 0.0,
                    "low_retention_count": 0,
                    "course_count": 0,
                },
                "courses": [],
            }
        )

    overall_avg = sum(r.retention for r in rows) / total_records
    overall_low = sum(1 for r in rows if needs_intervention(r.retention))

    by_course = {}
    for r in rows:
        by_course.setdefault(r.subject, []).append(r)

    course_items = []
    for course, course_rows in by_course.items():
        course_avg = sum(r.retention for r in course_rows) / len(course_rows)
        course_low = sum(1 for r in course_rows if needs_intervention(r.retention))

        improved_students = []
        for r in course_rows:
            if r.initial_score > 0 and r.final_score > r.initial_score:
                gained_pct = ((r.final_score - r.initial_score) / r.initial_score) * 100
                improved_students.append(
                    {
                        "student_id": r.student_id,
                        "name": r.student_name,
                        "gained_pct": round(gained_pct, 2),
                        "previous_mark": r.initial_score,
                        "current_mark": r.final_score,
                    }
                )
        improved_students.sort(key=lambda x: x["gained_pct"], reverse=True)

        high_risk_students = []
        for r in course_rows:
            if needs_intervention(r.retention):
                high_risk_students.append(
                    {
                        "student_id": r.student_id,
                        "name": r.student_name,
                        "retention": round(r.retention, 2),
                        "previous_mark": r.initial_score,
                        "current_mark": r.final_score,
                    }
                )
        high_risk_students.sort(key=lambda x: x["retention"])

        course_items.append(
            {
                "course": course,
                "average_retention": round(course_avg, 2),
                "low_retention_count": course_low,
                "top_improved_students": improved_students[:3],
                "high_risk_students": high_risk_students[:3],
            }
        )

    course_items.sort(key=lambda x: x["course"].lower())

    return jsonify(
        {
            "overall": {
                "total_records": total_records,
                "average_retention": round(overall_avg, 2),
                "low_retention_count": overall_low,
                "course_count": len(by_course),
            },
            "courses": course_items,
        }
    )


initialize_database()


if __name__ == "__main__":
    app.run(debug=True)
 
