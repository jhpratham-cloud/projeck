# Network Shooter

This is a simple multiplayer shooter made with Flask and Socket.IO.

cmd## Setup and how to run it

1. Open a terminal in this project folder.
2. Create a virtual environment:

	```bash
	python3 -m venv venv
	```

3. Activate the virtual environment:

	On macOS or Linux:

	```bash
	source venv/bin/activate
	```

	On Windows:

	```powershell
	venv\Scripts\activate
	```

4. Install the required Python packages:

	```bash
	python -m pip install Flask Flask-SocketIO
	```

5. Start the program:

	```bash
	python app.py
	```

6. Open this address in a web browser:

	http://localhost:8000

7. Enter a username to join the game.

To play with other people on the same network, they can open the computer's local IP address on port `8000`, for example `http://192.168.1.10:8000`.
