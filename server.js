require('dotenv').config();
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const { parse } = require("url");
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT, 10) || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const { initCron } = require('./cron');

app.prepare().then(() => {
    let lastEmitTime = 0;
    const DEBOUNCE_TIME = 2000; // 2 seconds

    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        if (req.method === 'POST' && parsedUrl.pathname === '/api/trigger-update') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    const source = data.source || 'unspecified';

                    if (global.io) {
                        const now = Date.now();
                        if (now - lastEmitTime > DEBOUNCE_TIME) {
                            global.io.emit('OCCUPANCY_UPDATE', {
                                timestamp: now,
                                source: source
                            });
                            lastEmitTime = now;
                            console.log(`[Socket] Emitted OCCUPANCY_UPDATE (Source: ${source})`);
                        } else {
                            console.log(`[Socket] Debounced update request from source: ${source}`);
                        }
                    }

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    console.error("Error triggering update:", e);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false }));
                }
            });
            return;
        }

        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer);
    global.io = io;
    initCron();

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
