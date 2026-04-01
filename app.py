from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

MEMORY_FILE = 'memory.json'

try:
    client = genai.Client()
except Exception as e:
    print("Failed to initialize Google GenAI Client.")
    client = None

def load_memory():
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except:
                return []
    return []

def save_memory(history):
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=2)

@app.route('/api/chat', methods=['POST'])
def chat():
    if not client:
        return jsonify({"error": "Gemini client not initialized. Check API Key."}), 500
        
    try:
        data = request.json
        current_messages = data.get('messages', [])

        if not current_messages:
            return jsonify({"error": "Messages array is required"}), 400
            
        long_term_memory = load_memory()
        formatted_contents = []
        
        # Inject long-term memory as a pseudo-system instruction
        if long_term_memory:
            memory_str = "Previous Long-Term Chat History:\n"
            # Only inject the last 8 messages to prevent massive token usage over time
            for item in long_term_memory[-8:]:
                memory_str += f"{item['role'].upper()}: {item['content']}\n"
                
            formatted_contents.append({
                "role": "user",
                "parts": [{"text": "SYSTEM INSTRUCTION: You have long-term memory of past chats. Use them if relevant to subsequent questions: " + memory_str}]
            })
            formatted_contents.append({
                "role": "model",
                "parts": [{"text": "Understood. I will remember this long-term context."}]
            })

        # Add the actual current session's flow
        for msg in current_messages:
            formatted_contents.append({
                "role": msg["role"],
                "parts": [{"text": msg["content"]}]
            })

        # Ask Gemini
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=formatted_contents,
        )

        # After success, record the latest exchange securely into long term memory
        if len(current_messages) > 0:
            last_user_msg = current_messages[-1]
            long_term_memory.append(last_user_msg)
            long_term_memory.append({"role": "model", "content": response.text})
            save_memory(long_term_memory)

        return jsonify({
            "response": response.text
        })
    except Exception as e:
        print(f"Error during Gemini API call: {e}")
        return jsonify({"error": "Failed to generate response", "details": str(e)}), 500

if __name__ == '__main__':
    print("Starting GenView Backend Server at http://127.0.0.1:5000/")
    app.run(debug=True, port=5000)
