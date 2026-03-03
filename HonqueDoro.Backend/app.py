from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta, timezone
import json
import os
from typing import Dict, List, Optional

app = Flask(__name__)
CORS(app, origins=["http://localhost:4200"])

MAX_DURATION_MINUTES = 180
MAX_NOTES_LENGTH = 500

# In-memory storage (in production, use a real database)
sessions = []
statistics = {
    "totalSessions": 0,
    "completedToday": 0,
    "currentStreak": 0,
    "bestStreak": 0
}

# Session types
class SessionType:
    WORK = 0
    SHORT_BREAK = 1
    LONG_BREAK = 2

# Session status
class SessionStatus:
    ACTIVE = "Active"
    PAUSED = "Paused"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

def get_active_session():
    """Get the currently active or paused session"""
    for session in sessions:
        if session["status"] in [SessionStatus.ACTIVE, SessionStatus.PAUSED]:
            return session
    return None

def parse_iso_datetime(dt_str):
    # Always parse as UTC
    return datetime.fromisoformat(dt_str.replace('Z', '+00:00')).astimezone(timezone.utc)

def calculate_remaining_seconds(session):
    """Calculate remaining seconds for a session"""
    if session["status"] == SessionStatus.COMPLETED:
        return 0
    
    total_duration = session["durationMinutes"] * 60
    elapsed = session["elapsedSeconds"]
    
    if session["status"] == SessionStatus.ACTIVE and session["lastUpdated"]:
        # Add time since last update
        last_update = parse_iso_datetime(session["lastUpdated"])
        elapsed += int((datetime.now(timezone.utc) - last_update).total_seconds())
    
    remaining = total_duration - elapsed
    return max(0, remaining)

def calculate_elapsed_seconds(session):
    """Calculate elapsed time including currently running time"""
    total_duration = session["durationMinutes"] * 60
    return max(0, total_duration - calculate_remaining_seconds(session))

def calculate_progress_percentage(session):
    total_seconds = session["durationMinutes"] * 60
    if total_seconds <= 0:
        return 0
    return min(100, (calculate_elapsed_seconds(session) / total_seconds) * 100)

def serialize_session(session):
    remaining = calculate_remaining_seconds(session)
    return {
        "id": session["id"],
        "type": session["type"],
        "status": session["status"],
        "durationMinutes": session["durationMinutes"],
        "remainingSeconds": remaining,
        "elapsedSeconds": calculate_elapsed_seconds(session),
        "estimatedEndTime": (datetime.now(timezone.utc) + timedelta(seconds=remaining)).isoformat().replace('+00:00', 'Z') if session["status"] == SessionStatus.ACTIVE and remaining > 0 else None,
        "progressPercentage": calculate_progress_percentage(session),
        "startTime": session["startTime"],
        "lastUpdated": session["lastUpdated"],
        "notes": session["notes"]
    }

def validate_start_session_payload(data):
    """Validate and normalize session start payload"""
    if not isinstance(data, dict):
        return None, jsonify({"error": "Invalid JSON payload"}), 400

    session_type = data.get("type", SessionType.WORK)
    if session_type not in [SessionType.WORK, SessionType.SHORT_BREAK, SessionType.LONG_BREAK]:
        return None, jsonify({"error": "Invalid session type"}), 400

    try:
        duration_minutes = int(data.get("durationMinutes", 25))
    except (TypeError, ValueError):
        return None, jsonify({"error": "durationMinutes must be an integer"}), 400

    if duration_minutes < 1 or duration_minutes > MAX_DURATION_MINUTES:
        return None, jsonify({"error": f"durationMinutes must be between 1 and {MAX_DURATION_MINUTES}"}), 400

    notes = data.get("notes", "") or ""
    if not isinstance(notes, str):
        return None, jsonify({"error": "notes must be a string"}), 400

    notes = notes.strip()
    if len(notes) > MAX_NOTES_LENGTH:
        return None, jsonify({"error": f"notes must be less than {MAX_NOTES_LENGTH + 1} characters"}), 400

    return {
        "type": session_type,
        "durationMinutes": duration_minutes,
        "notes": notes
    }, None, None

def update_session_elapsed(session):
    """Update elapsed time for an active session"""
    if session["status"] == SessionStatus.ACTIVE and session["lastUpdated"]:
        last_update = parse_iso_datetime(session["lastUpdated"])
        session["elapsedSeconds"] += int((datetime.now(timezone.utc) - last_update).total_seconds())
    session["lastUpdated"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

@app.route('/api/sessions/start', methods=['POST'])
def start_session():
    data = request.get_json(silent=True)
    payload, error_response, status_code = validate_start_session_payload(data)
    if error_response:
        return error_response, status_code
    
    # Check if there's already an active session
    active_session = get_active_session()
    if active_session:
        return jsonify({"error": "There is already an active session"}), 400
    
    session = {
        "id": len(sessions) + 1,
        "type": payload["type"],
        "durationMinutes": payload["durationMinutes"],
        "startTime": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "lastUpdated": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "status": SessionStatus.ACTIVE,
        "isCompleted": False,
        "notes": payload["notes"],
        "elapsedSeconds": 0,
        "pausedAt": None,
        "endTime": None
    }
    
    sessions.append(session)
    return jsonify(serialize_session(session))

@app.route('/api/sessions/pause/<int:session_id>', methods=['POST'])
def pause_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": f"Session with ID {session_id} not found"}), 404
    
    
    if session["status"] != SessionStatus.ACTIVE:
        return jsonify({"error": f"Session is not currently active. Current status: {session['status']}"}), 400
    
    update_session_elapsed(session)
    session["status"] = SessionStatus.PAUSED
    session["pausedAt"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    session["lastUpdated"] = None
    
    return jsonify(serialize_session(session))

@app.route('/api/sessions/resume/<int:session_id>', methods=['POST'])
def resume_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": f"Session with ID {session_id} not found"}), 404
    
    
    if session["status"] != SessionStatus.PAUSED:
        return jsonify({"error": f"Session is not currently paused. Current status: {session['status']}"}), 400
    
    session["status"] = SessionStatus.ACTIVE
    session["lastUpdated"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    session["pausedAt"] = None
    
    return jsonify(serialize_session(session))

@app.route('/api/sessions/complete/<int:session_id>', methods=['POST'])
def complete_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": f"Session with ID {session_id} not found"}), 404
    
    if session["isCompleted"]:
        return jsonify({"error": "Session is already completed"}), 400
    
    if session["status"] == SessionStatus.ACTIVE:
        update_session_elapsed(session)
    
    session["isCompleted"] = True
    session["status"] = SessionStatus.COMPLETED
    session["endTime"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    session["lastUpdated"] = None
    
    # Update statistics if it's a work session
    if session["type"] == SessionType.WORK:
        statistics["totalSessions"] += 1
        statistics["completedToday"] += 1
    
    return jsonify({"message": "Session completed successfully"})

@app.route('/api/sessions/skip/<int:session_id>', methods=['POST'])
def skip_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": f"Session with ID {session_id} not found"}), 404
    
    if session["isCompleted"]:
        return jsonify({"error": "Session is already completed"}), 400
    
    if session["status"] == SessionStatus.ACTIVE:
        update_session_elapsed(session)
    
    session["isCompleted"] = True
    session["status"] = SessionStatus.COMPLETED
    session["endTime"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    session["lastUpdated"] = None
    session["notes"] = "Session skipped by user"
    
    # Update statistics if it's a work session
    if session["type"] == SessionType.WORK:
        statistics["totalSessions"] += 1
        statistics["completedToday"] += 1
    
    return jsonify({"message": "Session skipped successfully"})

@app.route('/api/sessions/cancel/<int:session_id>', methods=['DELETE'])
def cancel_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": f"Session with ID {session_id} not found"}), 404
    
    if session["isCompleted"]:
        return jsonify({"error": "Cannot cancel a completed session"}), 400
    
    session["status"] = SessionStatus.CANCELLED
    session["lastUpdated"] = None
    session["endTime"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    return jsonify({"message": "Session cancelled successfully"})

@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": f"Session with ID {session_id} not found"}), 404
    
    if session["isCompleted"]:
        return jsonify({"error": "Cannot delete a completed session"}), 400
    
    session["status"] = SessionStatus.CANCELLED
    session["lastUpdated"] = None
    session["endTime"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    return jsonify({"message": "Session deleted successfully"})

@app.route('/api/sessions/active', methods=['GET'])
def get_active_session_endpoint():
    active_session = get_active_session()
    
    if not active_session:
        return jsonify({
            "hasActiveSession": False,
            "message": "No active session"
        })
    
    # Auto-complete if time is up
    remaining = calculate_remaining_seconds(active_session)
    if remaining <= 0 and active_session["status"] == SessionStatus.ACTIVE:
        active_session["isCompleted"] = True
        active_session["status"] = SessionStatus.COMPLETED
        active_session["endTime"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        active_session["lastUpdated"] = None
        
        if active_session["type"] == SessionType.WORK:
            statistics["totalSessions"] += 1
            statistics["completedToday"] += 1
        
        return jsonify({
            "hasActiveSession": False,
            "message": "Session automatically completed"
        })
    
    return jsonify({
        "hasActiveSession": True,
        "activeSession": serialize_session(active_session)
    })

@app.route('/api/sessions/<int:session_id>', methods=['GET'])
def get_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    serialized = serialize_session(session)
    return jsonify({
        "id": session["id"],
        "type": session["type"],
        "duration": session["durationMinutes"],
        "completedAt": session["endTime"] or session["startTime"],
        "isCompleted": session["isCompleted"],
        "notes": session["notes"],
        "status": session["status"],
        "remainingSeconds": serialized["remainingSeconds"],
        "elapsedSeconds": serialized["elapsedSeconds"],
        "estimatedEndTime": serialized["estimatedEndTime"],
        "progressPercentage": serialized["progressPercentage"],
        "lastUpdated": session["lastUpdated"]
    })

@app.route('/api/sessions/recent', methods=['GET'])
def get_recent_sessions():
    count = request.args.get('count', 10, type=int)
    completed_sessions = [s for s in sessions if s["isCompleted"]]
    recent_sessions = sorted(completed_sessions, key=lambda x: x["endTime"], reverse=True)[:count]
    
    return jsonify([{
        "id": session["id"],
        "type": session["type"],
        "duration": session["durationMinutes"],
        "completedAt": session["endTime"],
        "isCompleted": session["isCompleted"],
        "notes": session["notes"],
        "status": session["status"],
        "remainingSeconds": 0,
        "elapsedSeconds": session["elapsedSeconds"],
        "estimatedEndTime": None,
        "progressPercentage": 100,
        "lastUpdated": session["lastUpdated"]
    } for session in recent_sessions])

@app.route('/api/sessions/today', methods=['GET'])
def get_today_sessions():
    today = datetime.now(timezone.utc).date()
    today_sessions = [
        s for s in sessions 
        if s["isCompleted"] and s["endTime"] and 
        parse_iso_datetime(s["endTime"]).date() == today
    ]
    
    return jsonify([{
        "id": session["id"],
        "type": session["type"],
        "duration": session["durationMinutes"],
        "completedAt": session["endTime"],
        "isCompleted": session["isCompleted"],
        "notes": session["notes"],
        "status": session["status"],
        "remainingSeconds": 0,
        "elapsedSeconds": session["elapsedSeconds"],
        "estimatedEndTime": None,
        "progressPercentage": 100,
        "lastUpdated": session["lastUpdated"]
    } for session in today_sessions])

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    return jsonify(statistics)

@app.route('/health', methods=['GET'])
def health_check():
    return "HonqueDoro API is running!"

@app.route('/debug/sessions', methods=['GET'])
def debug_sessions():
    if app.debug:
        return jsonify({
            "total_sessions": len(sessions),
            "sessions": [{
                "id": s["id"],
                "type": s["type"],
                "status": s["status"],
                "isCompleted": s["isCompleted"],
                "remainingSeconds": calculate_remaining_seconds(s),
                "elapsedSeconds": calculate_elapsed_seconds(s)
            } for s in sessions]
        })
    return jsonify({"error": "Not found"}), 404

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_ENV', 'production') == 'development'
    app.run(host='0.0.0.0', port=5116, debug=debug_mode)
