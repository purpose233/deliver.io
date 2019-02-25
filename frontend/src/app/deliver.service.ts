import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import {of} from "rxjs";

const CHUNK_SIZE = 16384;

export interface User {
  name: string;
  id: string;
}

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

export interface ConfirmInfo {
  remoteId: string,
  received: boolean
}

export interface ConnectionInfo {
  pc: RTCPeerConnection,
  dataChannel: RTCDataChannel,
  file: File,
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

// TODO: handle multiple p2p transfer

@Injectable({
  providedIn: 'root'
})
export class DeliverService {
  name: string;
  users: User[];
  connections: ConnectionInfo[];
  // connection: RTCPeerConnection;

  constructor(private socket: Socket) {
    socket.on('users', (data) => {
      this.users = JSON.parse(data);
    });

    socket.on('confirmReceive', (data) => {
      if (data.received) {
        let connectionInfo = this.findConnectionInfo(data.remoteId);
        this.prepareSend(connectionInfo.remoteId);
      } else {
        console.log('不样发送');
        this.closeConnection(data.remoteId);
      }
    });

    socket.on('send', (data) => {
      this.confirmReceive(true, data);
    });

    socket.on('icecandidate', async (data) => {
      let candidateInfo: CandidateInfo = JSON.parse(data);
      let pc = this.findConnectionInfo(candidateInfo.remoteId).pc;
      await pc.addIceCandidate(candidateInfo.candidate);
    });

    socket.on('desc', async (data) => {
      let descInfo: DescInfo = JSON.parse(data);
      let pc = this.findConnectionInfo(descInfo.remoteId).pc;
      await pc.setRemoteDescription(descInfo.desc);
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
    let data: ConfirmInfo = {
      remoteId: p2pFileInfo.remoteId,
      received
    };
    this.socket.emit('receive', data);
    if (received) {
      let connectionInfo = this.createConnectionInfo(p2pFileInfo.remoteId,
        null, p2pFileInfo.fileSize);
      this.connections.push(connectionInfo);
      this.prepareReceive(connectionInfo.remoteId);
    }
  }

  createConnectionInfo(remoteId: string,
                       file: File = null,
                       fileSize: number = -1): ConnectionInfo {
    let size = -1;
    if (file) {
      size = file.size;
    } else if (fileSize !== -1) {
      size = fileSize;
    }
    return {
      pc: new RTCPeerConnection(),
      remoteId, file,
      dataChannel: null,
      fileSize: size,
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
    this.socket.emit('offer', data);
    connectionInfo.dataChannel = this.createSendChannel(pc);
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
    let answer = await this.createAnswer(pc);
    let data: DescInfo = {
      desc: answer,
      remoteId
    };
    this.socket.emit('answer', data);
    this.createReceiveChannel(pc);
  }

  sendData(pc: RTCPeerConnection, sendChannel: RTCDataChannel): void {
    const file = this.findConnectionInfo(pc).file;
    console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

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
    receiveChannel.onmessage = () => {
      this.onReceiveMessageCallback(event, pc, receiveChannel);
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
    this.socket.emit('name', name);
  }
}
