import asyncio
import json
import logging
from aiohttp import web
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaBlackhole, MediaRelay

relay = MediaRelay()
pcs = set()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AudioEchoTrack(MediaStreamTrack):
    kind = "audio"

    def __init__(self, track):
        super().__init__()
        self.track = track

    async def recv(self):
        frame = await self.track.recv()
        return frame

async def index(request):
    content = open("static/index.html", "r").read()
    return web.Response(content_type="text/html", text=content)

async def javascript(request):
    content = open("static/main.js", "r").read()
    return web.Response(content_type="application/javascript", text=content)

async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(
        sdp=params["sdp"],
        type=params["type"]
    )

    pc = RTCPeerConnection()
    pcs.add(pc)

    dc = None  # Store data channel reference

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        logger.info(f"Connection state is {pc.connectionState}")
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("datachannel")
    def on_datachannel(channel):
        nonlocal dc
        dc = channel
        logger.info(f"Data channel {channel.label} established")
        
        @channel.on("message")
        def on_message(message):
            if pc.connectionState == "connected" and dc and dc.readyState == "open":
                try:
                    async def send_echo():
                        try:
                            logger.info(f"Echoing message: {message} to data channel {dc.label}")
                            await dc.send(f"Echo: {message}")
                        except Exception as e:
                            logger.error(f"Failed to send message: {e}")
                            logger.error(f"Data channel state: {dc.readyState if dc else 'None'}")
                            logger.error(f"Connection state: {pc.connectionState}")
                            logger.error(f"Data channel label: {dc.label if dc else 'None'}")
                            logger.error(f"Message: {message}")
                    
                    asyncio.create_task(send_echo())
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
            else:
                logger.warning(f"Cannot send message - connection state: {pc.connectionState}, channel state: {dc.readyState if dc else 'None'}")

    @pc.on("track")
    def on_track(track):
        if track.kind == "audio":
            echo_track = AudioEchoTrack(relay.subscribe(track))
            pc.addTrack(echo_track)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps({
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type
        })
    )

async def on_shutdown(app):
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()

if __name__ == "__main__":
    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_get("/", index)
    app.router.add_get("/main.js", javascript)
    app.router.add_post("/offer", offer)
    app.router.add_static("/static/", path="static")
    web.run_app(app, host="0.0.0.0", port=8080)