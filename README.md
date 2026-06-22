# Dots & Boxes Socket.IO Backend

## Deploy on Render

1. Create a new GitHub repository.
2. Extract this ZIP and upload these files to that repository.
3. In Render, choose **New + → Web Service** and connect the repository.
4. Use:
   - Environment: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy.

After deployment, open the Render service URL and verify it shows JSON with `"status":"ok"`.

Send that URL back so the Netlify frontend can be built with it.

## Notes
- This demo stores rooms in server memory.
- If Render restarts, rooms are cleared.
- For production later, add Redis/database and authentication.
