from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta, timezone
import json
import os
from typing import Dict, List, Optional

app = Flask(__name__)
CORS(app, origins=["http://localhost:4200"])

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

def update_session_elapsed(session):
    """Update elapsed time for an active session"""
    if session["status"] == SessionStatus.ACTIVE and session["lastUpdated"]:
        last_update = parse_iso_datetime(session["lastUpdated"])
        session["elapsedSeconds"] += int((datetime.now(timezone.utc) - last_update).total_seconds())
    session["lastUpdated"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

@app.route('/api/sessions/start', methods=['POST'])
def start_session():
    data = request.get_json()
    
    # Check if there's already an active session
    active_session = get_active_session()
    if active_session:
        return jsonify({"error": "There is already an active session"}), 400
    
    session = {
        "id": len(sessions) + 1,
        "type": data.get("type", SessionType.WORK),
        "durationMinutes": data.get("durationMinutes", 25),
        "startTime": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "lastUpdated": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "status": SessionStatus.ACTIVE,
        "isCompleted": False,
        "notes": data.get("notes", ""),
        "elapsedSeconds": 0,
        "pausedAt": None,
        "endTime": None
    }
    
    sessions.append(session)
    return jsonify({
        "id": session["id"],
        "type": session["type"],
        "status": session["status"],
        "durationMinutes": session["durationMinutes"],
        "remainingSeconds": calculate_remaining_seconds(session),
        "elapsedSeconds": session["elapsedSeconds"],
        "estimatedEndTime": (datetime.now(timezone.utc) + timedelta(minutes=session["durationMinutes"])).isoformat().replace('+00:00', 'Z'),
        "progressPercentage": 0,
        "startTime": session["startTime"],
        "lastUpdated": session["lastUpdated"],
        "notes": session["notes"]
    })

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
    
    return jsonify({
        "id": session["id"],
        "type": session["type"],
        "status": session["status"],
        "durationMinutes": session["durationMinutes"],
        "remainingSeconds": calculate_remaining_seconds(session),
        "elapsedSeconds": session["elapsedSeconds"],
        "estimatedEndTime": None,
        "progressPercentage": (session["elapsedSeconds"] / (session["durationMinutes"] * 60)) * 100,
        "startTime": session["startTime"],
        "lastUpdated": session["lastUpdated"],
        "notes": session["notes"]
    })

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
    
    return jsonify({
        "id": session["id"],
        "type": session["type"],
        "status": session["status"],
        "durationMinutes": session["durationMinutes"],
        "remainingSeconds": calculate_remaining_seconds(session),
        "elapsedSeconds": session["elapsedSeconds"],
        "estimatedEndTime": (datetime.now(timezone.utc) + timedelta(seconds=calculate_remaining_seconds(session))).isoformat().replace('+00:00', 'Z'),
        "progressPercentage": (session["elapsedSeconds"] / (session["durationMinutes"] * 60)) * 100,
        "startTime": session["startTime"],
        "lastUpdated": session["lastUpdated"],
        "notes": session["notes"]
    })

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
        "activeSession": {
            "id": active_session["id"],
            "type": active_session["type"],
            "status": active_session["status"],
            "durationMinutes": active_session["durationMinutes"],
            "remainingSeconds": remaining,
            "elapsedSeconds": active_session["elapsedSeconds"],
            "estimatedEndTime": (datetime.now(timezone.utc) + timedelta(seconds=remaining)).isoformat().replace('+00:00', 'Z') if remaining > 0 else None,
            "progressPercentage": (active_session["elapsedSeconds"] / (active_session["durationMinutes"] * 60)) * 100,
            "startTime": active_session["startTime"],
            "lastUpdated": active_session["lastUpdated"],
            "notes": active_session["notes"]
        }
    })

@app.route('/api/sessions/<int:session_id>', methods=['GET'])
def get_session(session_id):
    session = next((s for s in sessions if s["id"] == session_id), None)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    return jsonify({
        "id": session["id"],
        "type": session["type"],
        "duration": session["durationMinutes"],
        "completedAt": session["endTime"] or session["startTime"],
        "isCompleted": session["isCompleted"],
        "notes": session["notes"],
        "status": session["status"],
        "remainingSeconds": calculate_remaining_seconds(session),
        "elapsedSeconds": session["elapsedSeconds"],
        "estimatedEndTime": (datetime.now(timezone.utc) + timedelta(seconds=calculate_remaining_seconds(session))).isoformat().replace('+00:00', 'Z') if calculate_remaining_seconds(session) > 0 else None,
        "progressPercentage": (session["elapsedSeconds"] / (session["durationMinutes"] * 60)) * 100,
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
    return jsonify({
        "total_sessions": len(sessions),
        "sessions": [{
            "id": s["id"],
            "type": s["type"],
            "status": s["status"],
            "isCompleted": s["isCompleted"],
            "remainingSeconds": calculate_remaining_seconds(s),
            "elapsedSeconds": s["elapsedSeconds"]
        } for s in sessions]
    })

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_ENV', 'production') == 'development'
    app.run(host='0.0.0.0', port=5116, debug=debug_mode)
