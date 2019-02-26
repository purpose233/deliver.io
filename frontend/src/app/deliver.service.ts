import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

const CHUNK_SIZE = 16384;
const CONFIGURATION = {
  iceServers: [
    {urls: "stun:23.21.150.121"},
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "turn:numb.viagenie.ca", credential: "webrtcdemo", username: "louis%40mozilla.com"}
  ]
};

export interface User {
  name: string;
  id: string;
}

// TODO: handle the relation with task
export interface Task {
  type: 'send' | 'receive',
  progress: number,
  remoteName: string,
  fileName: string,
  fileSize: string,
  fileType: string,
  blob: Blob,
  url: string
}

export interface P2PFileInfo {
  remoteName: string,
  remoteId: string,
  fileName: string,
  fileSize: number,
  fileType: string
}

export interface ConfirmSendInfo {
  remoteId: string,
  received: boolean
}

export interface ConnectionInfo {
  pc: RTCPeerConnection,
  dataChannel: RTCDataChannel,
  file: File,
  fileName: string,
  fileSize: number,
  remoteId: string,

  // used for received
  receivedBuffer: any[],
  receivedSize: number
}

export interface DescInfo {
  desc: RTCSessionDescriptionInit,
  remoteId: string
}

export interface CandidateInfo {
  candidate: RTCIceCandidate,
  remoteId: string
}

// TODO: handle all types of errors
export interface ErrorInfo {
  type: string
}

// TODO: handle multiple p2p transfer
// TODO: add sending status for send button

@Injectable({
  providedIn: 'root'
})
export class DeliverService {
  name: string;
  users: User[];
  connections: ConnectionInfo[] = [];
  // connection: RTCPeerConnection;

  constructor(private socket: Socket) {
    // data type: User
    socket.on('users', (data) => {
      this.users = data;
    });

    // data type: ConfirmSendInfo
    socket.on('confirmSend', (data) => {
      console.log('socket on confirmSend');
      if (data.received) {
        let connectionInfo = this.findConnectionInfo(data.remoteId);
        this.prepareSend(connectionInfo.remoteId);
      } else {
        console.log('不样发送');
        this.closeConnection(data.remoteId);
      }
    });

    // data type: P2PFileInfo
    socket.on('confirmReceive', (data) => {
      console.log('socket on confirmReceive');
      this.confirmReceive(true, data);
    });

    // data type: CandidateInfo
    socket.on('candidate', async (data) => {
      console.log('socket on candidate, data: ', data);
      let candidateInfo: CandidateInfo = data;
      // Candidate missing values for both sdpMid and sdpMLineIndex
      if (candidateInfo.candidate == null) {
        return;
      }
      let pc = this.findConnectionInfo(candidateInfo.remoteId).pc;
      await pc.addIceCandidate(candidateInfo.candidate);
    });

    // data type: DescInfo
    socket.on('desc', async (data) => {
      console.log('socket on desc');
      let descInfo: DescInfo = data;
      let pc = this.findConnectionInfo(descInfo.remoteId).pc;
      await pc.setRemoteDescription(descInfo.desc);
      if (descInfo.desc.type === 'offer') {
        let answer = await this.createAnswer(pc);
        let data: DescInfo = {
          desc: answer,
          remoteId: descInfo.remoteId
        };
        this.socket.emit('desc', data);
        this.createReceiveChannel(pc);
      }
    });

    // data type: ErrorInfo
    socket.on('error', (data) => {

    });
  }

  checkFile(file: File): boolean {
    return file.size !== 0;
  }

  commitSend(remoteId: string, file: File): void {
    let data: P2PFileInfo = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      remoteId, remoteName: null
    };
    let connectionInfo = this.createConnectionInfo(remoteId, file);
    this.connections.push(connectionInfo);
    this.socket.emit('send', data);
  }

  confirmReceive(received: boolean, p2pFileInfo: P2PFileInfo): void {
    let data: ConfirmSendInfo = {
      remoteId: p2pFileInfo.remoteId,
      received
    };
    this.socket.emit('receive', data);
    if (received) {
      let connectionInfo = this.createConnectionInfo(p2pFileInfo.remoteId, p2pFileInfo);
      this.connections.push(connectionInfo);
      this.prepareReceive(connectionInfo.remoteId);
    }
  }

  createConnectionInfo(remoteId: string,
                       file: File | P2PFileInfo): ConnectionInfo {
    return {
      pc: new RTCPeerConnection(CONFIGURATION),
      remoteId,
      dataChannel: null,
      file: file instanceof File ? file : null,
      // TODO: unite the File and P2PFileInfo so that it could be simple
      fileName: file instanceof File ? file.name : file.fileName,
      fileSize: file instanceof File ? file.size : file.fileSize,
      receivedBuffer: [],
      receivedSize: 0
    };
  }

  findConnectionInfo(refer: string | RTCPeerConnection): ConnectionInfo {
    if (typeof refer === 'string') {
      for (let connection of this.connections) {
        if (refer === connection.remoteId) {
          return connection;
        }
      }
    } else if (refer instanceof RTCPeerConnection) {
      for (let connection of this.connections) {
        if (refer === connection.pc) {
          return connection;
        }
      }
    }
    return null;
  }

  findConnectionInfoIndex(refer: string | RTCPeerConnection): number {
    if (typeof refer === 'string') {
      for (let index = 0; index < this.connections.length; index++) {
        if (refer === this.connections[index].remoteId) {
          return index;
        }
      }
    } else if (refer instanceof RTCPeerConnection) {
      for (let index = 0; index < this.connections.length; index++) {
        if (refer === this.connections[index].pc) {
          return index;
        }
      }
    }
    return -1;
  }

  deleteConnectinoInfo(refer: string | RTCPeerConnection): void {
    let index = this.findConnectionInfoIndex(refer);
    if (index >= 0) {
      this.connections.splice(index, 1);
    }
  }

  // TODO: don't know how to write the return type for async function
  async createOffer(pc: RTCPeerConnection) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // console.log(`Offer from localConnection\n ${offer.desc}`);
    return offer;
  }

  async createAnswer(pc: RTCPeerConnection) {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  createSendChannel(pc: RTCPeerConnection): RTCDataChannel {
    let sendChannel = pc.createDataChannel('sendDataChannel');

    // need to use clojure to pass the channel and pc
    sendChannel.addEventListener('open', () => {
      this.onSendChannelStateChange(pc, sendChannel);
    });
    sendChannel.addEventListener('close', () => {
      this.onSendChannelStateChange(pc, sendChannel);
    });
    sendChannel.addEventListener('error', (error) => {
      this.onDataChannelError(error);
    });

    return sendChannel;
  }

  // different from createSendChannel, the receive channel won't be and needn't be returned.
  createReceiveChannel(pc: RTCPeerConnection): void {
    pc.addEventListener('datachannel', (event) => {
      this.receiveChannelCallback(pc, event);
    });
  }

  async prepareSend(remoteId: string) {
    let connectionInfo = this.findConnectionInfo(remoteId);
    let pc = connectionInfo.pc;
    connectionInfo.dataChannel = this.createSendChannel(pc);
    pc.addEventListener('icecandidate', async event => {
      console.log('Local ICE candidate: ', event.candidate);
      // await remoteConnection.addIceCandidate(event.candidate);
      let data: CandidateInfo = {
        candidate: event.candidate,
        remoteId
      };
      this.socket.emit('candidate', data);
    });
    let offer = await this.createOffer(pc);
    let data: DescInfo = {
      desc: offer,
      remoteId
    };
    this.socket.emit('desc', data);
  }

  async prepareReceive(remoteId: string) {
    let pc = this.findConnectionInfo(remoteId).pc;
    pc.addEventListener('icecandidate', async event => {
      console.log('Local ICE candidate: ', event.candidate);
      // await remoteConnection.addIceCandidate(event.candidate);
      let data: CandidateInfo = {
        candidate: event.candidate,
        remoteId
      };
      this.socket.emit('candidate', data);
    });
  }

  sendData(pc: RTCPeerConnection, sendChannel: RTCDataChannel): void {
    const file = this.findConnectionInfo(pc).file;
    console.log(`Begin send file: ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

    let fileReader = new FileReader();
    let offset = 0;
    fileReader.addEventListener('error', error => console.error('Error reading file:', error));
    // TODO: enable to abort file transfer
    // fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
    fileReader.addEventListener('load', e => {
      console.log('FileRead.onload ', e);
      sendChannel.send((<any>e.target).result);
      offset += (<any>e.target).result.byteLength;
      if (offset < file.size) {
        readSlice(offset);
      }
    });
    const readSlice = o => {
      console.log('readSlice ', o);
      const slice = file.slice(offset, o + CHUNK_SIZE);
      fileReader.readAsArrayBuffer(slice);
    };
    readSlice(0);
  }

  closeConnection(refer: RTCPeerConnection | string): void {
    let connectionInfo = this.findConnectionInfo(refer);
    if (connectionInfo.dataChannel) {
      connectionInfo.dataChannel.close();
    }
    if (connectionInfo.pc) {
      connectionInfo.pc.close();
    }
    this.deleteConnectinoInfo(refer);
  }

  onSendChannelStateChange(pc: RTCPeerConnection, sendChannel: RTCDataChannel): void {
    const readyState = sendChannel.readyState;
    console.log(`Send channel state is: ${readyState}`);
    if (readyState === 'open') {
      this.sendData(pc, sendChannel);
    }
  }

  receiveChannelCallback (pc: RTCPeerConnection, event: RTCDataChannelEvent): void {
    console.log('Receive Channel Callback');
    let receiveChannel = event.channel;
    receiveChannel.binaryType = 'arraybuffer';
    receiveChannel.onmessage = (e) => {
      this.onReceiveMessageCallback(e, pc, receiveChannel);
    };
    receiveChannel.onopen = () => {
      this.onReceiveChannelStateChange(pc, receiveChannel);
    };
    receiveChannel.onclose = () => {
      this.onReceiveChannelStateChange(pc, receiveChannel);
    };
    this.findConnectionInfo(pc).dataChannel = receiveChannel;
  }

  // cannot find the class of event
  onReceiveMessageCallback(event, pc: RTCPeerConnection, receiveChannel: RTCDataChannel): void {
    console.log(`Received Message ${event.data.byteLength}`);
    let connectionInfo = this.findConnectionInfo(pc);
    connectionInfo.receivedBuffer.push(event.data);
    connectionInfo.receivedSize += event.data.byteLength;

    if (connectionInfo.receivedSize === connectionInfo.fileSize) {
      const blob = new Blob(connectionInfo.receivedBuffer);
      const url = URL.createObjectURL(blob);
      // connectionInfo.receiveBuffer = [];
      console.log('Received blob: ' + blob);

      let link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.setAttribute('download', connectionInfo.fileName);
      document.body.appendChild(link);
      link.click();

      this.closeConnection(pc);
    }
  }

  onReceiveChannelStateChange(pc: RTCPeerConnection, receiveChannel: RTCDataChannel): void {
    const readyState = receiveChannel.readyState;
    console.log(`Receive channel state is: ${readyState}`);
    if (readyState === 'open') {
    }
  }

  onDataChannelError(error: RTCErrorEvent) {
    console.error('Error in sendChannel:', error);
  }

  sendName(name: string) {
    this.name = name;
    this.socket.emit('name', { name });
  }
}
