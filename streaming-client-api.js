'use strict';

// auth
const DID_API = {
    "key": "",
    "url": "https://api.d-id.com"
}

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection)
    .bind(window);

// --- var

// origin var
let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;

// source var
// 虚拟形象图片
const source_img_url = "https://d-id-public-bucket.s3.amazonaws.com/or-roman.jpg";

// dynamic var
let texts;
let imageUrls;
let videoUrls;

// --- html element

// video
const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
// status label
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

// form
const form = document.getElementById('upload-form');
const result = document.getElementById('result');
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload');
    xhr.onload = () => {
        if (xhr.status === 200) {
            result.innerHTML = '上传成功！';
        } else {
            result.innerHTML = '上传失败！';
        }
    };
    xhr.send(formData);
});

// --- button

// connect
const connectButton = document.getElementById('connect-button');
connectButton.onclick = async () => {
    if (peerConnection && peerConnection.connectionState === 'connected') {
        return;
    }

    stopAllStreams();
    closePC();

    // 开启did会话
    const sessionResponse = await fetch(`${DID_API.url}/talks/streams`, {
        method: 'POST',
        headers: {'Authorization': `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({
            source_url: source_img_url
        }),
    });

    // 创建连接的answer
    const {id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId} = await sessionResponse.json()
    streamId = newStreamId;
    sessionId = newSessionId;

    try {
        sessionClientAnswer = await createPeerConnection(offer, iceServers);
    } catch (e) {
        console.log('error during streaming setup', e);
        stopAllStreams();
        closePC();
        return;
    }

    const sdpResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`,
        {
            method: 'POST',
            headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({answer: sessionClientAnswer, session_id: sessionId})
        });
};

const talkButton = document.getElementById('talk-button');
talkButton.onclick = async () => {
    // connectionState not supported in firefox
    if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {

        var name = document.getElementById("name").value;
        var city = document.getElementById("city").value;


        // const welcome = await fetch(`http://localhost:8080/welcome`,
        //     {
        //         method: 'POST',
        //         headers: {'Content-Type': 'application/json'},
        //         body: JSON.stringify({
        //             'name': name,
        //             'trip': city
        //         })
        //     });
        // console.log("welcome接口的返回结果：" + welcome.body)

        // let audio_url = welcome.body
        let audio_url = 'https://aioverflow.s3.ap-southeast-1.amazonaws.com/1685191909354_sound.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20230527T125151Z&X-Amz-SignedHeaders=host&X-Amz-Expires=3599&X-Amz-Credential=AKIAWPJJ4H3J2HJNBAWC%2F20230527%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=adc11d8968952e41e327b08c8c98109ff0dd2e5b88328fdad9d4140edb7573c1'

        const talkResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}`,
            {
                method: 'POST',
                headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({
                    'script': {
                        'type': 'audio',
                        // 'audio_url': 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/webrtc.mp3',
                        // 'audio_url': 'https://aioverflow.s3.ap-southeast-1.amazonaws.com/dali-demo.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20230527T112424Z&X-Amz-SignedHeaders=host&X-Amz-Expires=3599&X-Amz-Credential=AKIAWPJJ4H3J2HJNBAWC%2F20230527%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=80c5611a9ecfe0d1da154ce63fe1fed204640674c44c3d69340d941b3c908d95',
                        'audio_url': audio_url,
                    },
                    'driver_url': 'bank://lively/',
                    'config': {
                        'stitch': true,
                    },
                    'session_id': sessionId
                })
            });
    }
};

const destroyButton = document.getElementById('destroy-button');
destroyButton.onclick = async () => {
    await fetch(`${DID_API.url}/talks/streams/${streamId}`,
        {
            method: 'DELETE',
            headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({session_id: sessionId})
        });

    stopAllStreams();
    closePC();
};

function onIceGatheringStateChange() {
    iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
    iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}

function onIceCandidate(event) {
    console.log('onIceCandidate', event);
    if (event.candidate) {
        const {candidate, sdpMid, sdpMLineIndex} = event.candidate;

        fetch(`${DID_API.url}/talks/streams/${streamId}/ice`,
            {
                method: 'POST',
                headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({candidate, sdpMid, sdpMLineIndex, session_id: sessionId})
            });
    }
}

function onIceConnectionStateChange() {
    iceStatusLabel.innerText = peerConnection.iceConnectionState;
    iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
    if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
        stopAllStreams();
        closePC();
    }
}

function onConnectionStateChange() {
    // not supported in firefox
    peerStatusLabel.innerText = peerConnection.connectionState;
    peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}

function onSignalingStateChange() {
    signalingStatusLabel.innerText = peerConnection.signalingState;
    signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}

function onTrack(event) {
    const remoteStream = event.streams[0];
    setVideoElement(remoteStream);
}

async function createPeerConnection(offer, iceServers) {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection({iceServers});
        peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
        peerConnection.addEventListener('icecandidate', onIceCandidate, true);
        peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
        peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
        peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
        peerConnection.addEventListener('track', onTrack, true);
    }

    await peerConnection.setRemoteDescription(offer);
    console.log('set remote sdp OK');

    const sessionClientAnswer = await peerConnection.createAnswer();
    console.log('create local sdp OK');

    await peerConnection.setLocalDescription(sessionClientAnswer);
    console.log('set local sdp OK');

    return sessionClientAnswer;
}

function setVideoElement(stream) {
    if (!stream) return;
    talkVideo.srcObject = stream;

    // safari hotfix
    if (talkVideo.paused) {
        talkVideo.play().then(_ => {
        }).catch(e => {
        });
    }
}

function stopAllStreams() {
    // 关闭视频
    if (talkVideo.srcObject) {
        console.log('stopping video streams');
        talkVideo.srcObject.getTracks().forEach(track => track.stop());
        talkVideo.srcObject = null;
    }

    // 清理变量资源
    texts = null;
    imageUrls = null;
    videoUrls = null;
}

function closePC(pc = peerConnection) {
    if (!pc) return;
    console.log('stopping peer connection');
    pc.close();
    pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    pc.removeEventListener('icecandidate', onIceCandidate, true);
    pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
    pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
    pc.removeEventListener('track', onTrack, true);
    iceGatheringStatusLabel.innerText = '';
    signalingStatusLabel.innerText = '';
    iceStatusLabel.innerText = '';
    peerStatusLabel.innerText = '';
    console.log('stopped peer connection');
    if (pc === peerConnection) {
        peerConnection = null;
    }
}
