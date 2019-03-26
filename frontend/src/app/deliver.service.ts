import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

// The max cache size of data channel is 16mb, so the CHUNK_SIZE * SLICE_COUNT
//  shouldn't be greater than 16mb.
const CHUNK_SIZE = 256 * 1024;
const SLICE_COUNT = 16;
const CONFIGURATION = {
  iceServers: [
    {urls: 'stun:23.21.150.121'},
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'turn:numb.viagenie.ca', credential: 'webrtcdemo', username: 'louis%40mozilla.com'}
  ]
};

export interface User {
  name: string;
  id: string;
  isTransferring?: boolean;
}

// TODO: handle the relation with task
export interface Task {
  type: 'send' | 'receive';
  state: 'finished' | 'inProgress' | 'rejected';
  progress: number;
  remoteName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  blob: Blob;
  url: string;
  // the count of transferred Bytes per second
  speed: number;
}

export interface P2PFileInfo {
  remoteName: string;
  remoteId: string;
  name: string;
  size: number;
  type: string;
}

export interface ConfirmSendInfo {
  remoteId: string;
  received: boolean;
}

export interface ConnectionInfo {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  file: File;
  fileName: string;
  fileSize: number;
  remoteId: string;
  task: Task;
  sliceCount: number;

  // used for send
  isSending: boolean;
  reader: FileReader;
  readOffset: number;

  // used for receive
  receivedBuffer: any[];
  receivedSize: number;
}

export interface DescInfo {
  desc: RTCSessionDescriptionInit;
  remoteId: string;
}

export interface CandidateInfo {
  candidate: RTCIceCandidate;
  remoteId: string;
}

export interface ReceiveState {
  state: 'finished' | 'error' | 'inProgress';
  remoteId: string;
  progress?: number;
}

// TODO: handle all types of errors
export interface ErrorInfo {
  type: string;
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
  tasks: Task[] = [];

  constructor(private socket: Socket) {
    // data type: User
    socket.on('users', (data) => {
      const userInfo: User[] = data;
      for (const user of userInfo) {
        user.isTransferring = false;
      }
      this.users = userInfo;
    });

    // data type: ConfirmSendInfo
    socket.on('confirmSend', (data) => {
      console.log('socket on confirmSend');
      const connectionInfo = this.findConnectionInfo(data.remoteId);
      if (data.received) {
        this.prepareSend(connectionInfo.remoteId);
      } else {
        console.log('不样发送');
        connectionInfo.task.state = 'rejected';
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
      const candidateInfo: CandidateInfo = data;
      // Candidate missing values for both sdpMid and sdpMLineIndex
      if (candidateInfo.candidate == null) {
        return;
      }
      const pc = this.findConnectionInfo(candidateInfo.remoteId).pc;
      await pc.addIceCandidate(candidateInfo.candidate);
    });

    // data type: DescInfo
    socket.on('desc', async (data) => {
      console.log('socket on desc');
      const descInfo: DescInfo = data;
      const pc = this.findConnectionInfo(descInfo.remoteId).pc;
      await pc.setRemoteDescription(descInfo.desc);
      if (descInfo.desc.type === 'offer') {
        const answer = await this.createAnswer(pc);
        const descData: DescInfo = {
          desc: answer,
          remoteId: descInfo.remoteId
        };
        this.socket.emit('desc', descData);
        this.createReceiveChannel(pc);
      }
    });

    // data type: ReceiveState
    socket.on('receiveState', (data) => {
      // console.log('socket on receive state');
      const receiveState: ReceiveState = data;
      const connectionInfo = this.findConnectionInfo(receiveState.remoteId);
      if (receiveState.state === 'finished') {
        connectionInfo.task.state = 'finished';
        this.closeConnection(receiveState.remoteId);
      } else if (receiveState.state === 'inProgress') {
        this.continueSend(connectionInfo);
      }
    });

    // data type: ErrorInfo
    socket.on('error', (data) => {

    });
  }

  createTask(type: 'send' | 'receive',
             file: File | P2PFileInfo,
             remoteId: string): Task {
    return {
      type,
      state: 'inProgress',
      progress: 0,
      remoteName: this.findUser(remoteId).name,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      blob: null,
      url: null,
      speed: 0
    };
  }

  checkFile(file: File): boolean {
    return file.size !== 0;
  }

  commitSend(remoteId: string, file: File): void {
    const data: P2PFileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      remoteId, remoteName: null
    };
    const task = this.createTask('send', file, remoteId);
    this.tasks.push(task);
    const connectionInfo = this.createConnectionInfo(remoteId, file, task);
    this.connections.push(connectionInfo);
    this.socket.emit('send', data);
  }

  confirmReceive(received: boolean, p2pFileInfo: P2PFileInfo): void {
    const data: ConfirmSendInfo = {
      remoteId: p2pFileInfo.remoteId,
      received
    };
    this.socket.emit('receive', data);
    const task = this.createTask('receive', p2pFileInfo, p2pFileInfo.remoteId);
    this.tasks.push(task);
    if (received) {
      const connectionInfo = this.createConnectionInfo(p2pFileInfo.remoteId, p2pFileInfo, task);
      this.connections.push(connectionInfo);
      this.prepareReceive(connectionInfo.remoteId);
    } else {
      task.state = 'rejected';
    }
  }

  createConnectionInfo(remoteId: string,
                       file: File | P2PFileInfo,
                       task: Task): ConnectionInfo {
    this.findUser(remoteId).isTransferring = true;
    return {
      pc: new RTCPeerConnection(CONFIGURATION),
      remoteId,
      dataChannel: null,
      file: file instanceof File ? file : null,
      fileName: file.name,
      fileSize: file.size,
      task,
      isSending: false,
      sliceCount: 0,
      reader: null,
      readOffset: 0,
      receivedBuffer: [],
      receivedSize: 0
    };
  }

  findConnectionInfo(refer: string | RTCPeerConnection): ConnectionInfo {
    if (typeof refer === 'string') {
      for (const connection of this.connections) {
        if (refer === connection.remoteId) {
          return connection;
        }
      }
    } else if (refer instanceof RTCPeerConnection) {
      for (const connection of this.connections) {
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

  findUser(refer: string): User {
    for (const user of this.users) {
      if (refer === user.id) {
        return user;
      }
    }
    return null;
  }

  deleteConnectionInfo(refer: string | RTCPeerConnection): void {
    const index = this.findConnectionInfoIndex(refer);
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
    const sendChannel = pc.createDataChannel('sendDataChannel');

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
    const connectionInfo = this.findConnectionInfo(remoteId);
    const pc = connectionInfo.pc;
    connectionInfo.dataChannel = this.createSendChannel(pc);
    pc.addEventListener('icecandidate', async event => {
      console.log('Local ICE candidate: ', event.candidate);
      // await remoteConnection.addIceCandidate(event.candidate);
      const candidateData: CandidateInfo = {
        candidate: event.candidate,
        remoteId
      };
      this.socket.emit('candidate', candidateData);
    });
    const offer = await this.createOffer(pc);
    const descData: DescInfo = {
      desc: offer,
      remoteId
    };
    this.socket.emit('desc', descData);
  }

  async prepareReceive(remoteId: string) {
    const pc = this.findConnectionInfo(remoteId).pc;
    pc.addEventListener('icecandidate', async event => {
      console.log('Local ICE candidate: ', event.candidate);
      // await remoteConnection.addIceCandidate(event.candidate);
      const candidateData: CandidateInfo = {
        candidate: event.candidate,
        remoteId
      };
      this.socket.emit('candidate', candidateData);
    });
  }

  calcProgress(currentSize: number, totalSize: number): number {
    return Math.round(currentSize / totalSize * 100);
  }

  readSlice(file, offset, reader) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    reader.readAsArrayBuffer(slice);
  }

  // TODO: the send percentage might need to get from the socket
  beginSendData(connectionInfo: ConnectionInfo, sendChannel: RTCDataChannel): void {
    const { file, task } = connectionInfo;
    console.log(`Begin send file: ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

    const fileReader = new FileReader();
    connectionInfo.reader = fileReader;
    fileReader.addEventListener('error', error => console.error('Error reading file:', error));
    // TODO: enable to abort file transfer
    // fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
    fileReader.addEventListener('load', e => {
      // console.log('FileRead.onload ', e);
      sendChannel.send((<any>e.target).result);
      connectionInfo.readOffset += (<any>e.target).result.byteLength;
      if (connectionInfo.readOffset < file.size) {
        task.progress = this.calcProgress(connectionInfo.readOffset, file.size);
        // send SLICE_COUNT slice one time
        if (connectionInfo.sliceCount < SLICE_COUNT) {
          this.readSlice(file, connectionInfo.readOffset, fileReader);
          connectionInfo.sliceCount++;
        } else {
          connectionInfo.sliceCount = 1;
        }
      } else {
        task.progress = 100;
      }
    });
    this.readSlice(file, 0, fileReader);
    connectionInfo.isSending = true;
    connectionInfo.sliceCount++;
  }

  continueSend(connectionInfo: ConnectionInfo) {
    this.readSlice(connectionInfo.file, connectionInfo.readOffset, connectionInfo.reader);
  }

  closeConnection(refer: RTCPeerConnection | string): void {
    const connectionInfo = this.findConnectionInfo(refer);
    this.findUser(connectionInfo.remoteId).isTransferring = false;
    if (connectionInfo.dataChannel) {
      connectionInfo.dataChannel.close();
    }
    if (connectionInfo.pc) {
      connectionInfo.pc.close();
    }
    this.deleteConnectionInfo(refer);
  }

  onSendChannelStateChange(pc: RTCPeerConnection, sendChannel: RTCDataChannel): void {
    const readyState = sendChannel.readyState;
    console.log(`Send channel state is: ${readyState}`);
    if (readyState === 'open') {
      const connectionInfo = this.findConnectionInfo(pc);
      this.beginSendData(connectionInfo, sendChannel);
    }
  }

  receiveChannelCallback (pc: RTCPeerConnection, event: RTCDataChannelEvent): void {
    console.log('Receive Channel Callback');
    const receiveChannel = event.channel;
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
    // console.log(`Received Message ${event.data.byteLength}`);
    const connectionInfo = this.findConnectionInfo(pc);
    connectionInfo.receivedBuffer.push(event.data);
    connectionInfo.receivedSize += event.data.byteLength;
    const task = connectionInfo.task;

    if (connectionInfo.receivedSize === connectionInfo.fileSize) {
      task.progress = 100;
      task.state = 'finished';
      task.blob = new Blob(connectionInfo.receivedBuffer);
      task.url = URL.createObjectURL(task.blob);
      // connectionInfo.receiveBuffer = [];
      console.log('Received blob: ' + task.blob);

      this.closeConnection(pc);
      const receiveState: ReceiveState = {
        state: 'finished',
        remoteId: connectionInfo.remoteId
      };
      this.socket.emit('receiveState', receiveState);
    } else {
      task.progress = this.calcProgress(connectionInfo.receivedSize, connectionInfo.fileSize);
      // TODO: the synchronous progress need to improve
      connectionInfo.sliceCount++;
      if (connectionInfo.sliceCount === SLICE_COUNT) {
        const receiveState: ReceiveState = {
          state: 'inProgress',
          progress: task.progress,
          remoteId: connectionInfo.remoteId
        };
        this.socket.emit('receiveState', receiveState);
        connectionInfo.sliceCount = 0;
      }
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
