import { Injectable, NgZone } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { BehaviorSubject } from 'rxjs';
import { List } from 'immutable';

// The max cache size of data channel is 16mb, so the CHUNK_SIZE * SLICE_COUNT
//  shouldn't be greater than 16mb.
const CHUNK_SIZE = 16 * 1024;
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
  state: 'finished' | 'inProgress' | 'waiting' | 'rejected';
  progress: number;
  remoteName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  blob: Blob;
  url: string;
  // the count of transferred Bytes per second
  lastTime: number;
  speed: number;
  // For now, it is only used for store the p2pFileInfo of waiting task
  refFile: File | P2PFileInfo;
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

@Injectable({
  providedIn: 'root'
})
export class DeliverService {
  private name = new BehaviorSubject<string>(null);
  nameObservable = this.name.asObservable();
  private users = new BehaviorSubject<User[]>([]);
  usersObservable = this.users.asObservable();
  // TODO: don't know the type of List
  private tasks = new BehaviorSubject(List([]));
  // private tasks = new BehaviorSubject<Task[]>([]);
  tasksObservable = this.tasks.asObservable();

  connections: ConnectionInfo[] = [];
  // tasks: Task[] = [];

  constructor(private socket: Socket,
              private zone: NgZone) {
    // data type: User
    socket.on('users', (data) => {
      const userInfo: User[] = data;
      for (const user of userInfo) {
        user.isTransferring = false;
      }
      this.users.next(userInfo);
    });

    // data type: ConfirmSendInfo
    socket.on('confirmSend', (data) => {
      console.log('socket on confirmSend');
      const connectionInfo = this.findConnectionInfo(data.remoteId);
      if (data.received) {
        this.updateTaskState(connectionInfo.task, 'inProgress');
        this.prepareSend(connectionInfo.remoteId);
      } else {
        console.log('不样发送');
        this.updateTaskState(connectionInfo.task, 'rejected');
        this.closeConnection(data.remoteId);
      }
    });

    // data type: P2PFileInfo
    socket.on('confirmReceive', (data) => {
      console.log('socket on confirmReceive');
      const p2pFileInfo: P2PFileInfo = data;
      const task = this.createTask('receive', p2pFileInfo, p2pFileInfo.remoteId);
      this.addTask(task);
      this.setUserState(this.findUser(p2pFileInfo.remoteId), true);
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
        this.updateTaskState(connectionInfo.task, 'finished');
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
      state: 'waiting',
      progress: 0,
      remoteName: this.findUser(remoteId).name,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      blob: null,
      url: null,
      speed: 0,
      lastTime: 0,
      refFile: file
    };
  }

  addTask(task: Task) {
    this.tasks.next(this.tasks.getValue().push(task));
  }

  updateTask(task: Task, func) {
    this.zone.run(() => {
      const taskList = this.tasks.getValue();
      this.tasks.next(taskList.update(taskList.indexOf(task), func));
    });
  }

  updateTaskProgress(task: Task, progress: number) {
    this.updateTask(task, (val: Task) => {
      val.progress = progress;
      const currentTime = new Date().getTime();
      if (val.lastTime !== 0) {
        val.speed = CHUNK_SIZE * SLICE_COUNT / (currentTime - val.lastTime) * 1000;
      }
      val.lastTime = currentTime;
      return val;
    });
  }

  updateTaskState(task: Task, state: 'finished' | 'inProgress' | 'rejected') {
    this.updateTask(task, (val: Task) => {
      val.state = state;
      return val;
    });
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
    this.addTask(task);
    const connectionInfo = this.createConnectionInfo(remoteId, file, task);
    this.connections.push(connectionInfo);
    this.socket.emit('send', data);
  }

  confirmReceive(allowReceive: boolean, task: Task): void {
    const p2pFileInfo: P2PFileInfo = <P2PFileInfo>task.refFile;
    const data: ConfirmSendInfo = {
      remoteId: p2pFileInfo.remoteId,
      received: allowReceive
    };
    this.socket.emit('receive', data);
    if (allowReceive) {
      const connectionInfo = this.createConnectionInfo(p2pFileInfo.remoteId, p2pFileInfo, task);
      this.connections.push(connectionInfo);
      this.prepareReceive(connectionInfo.remoteId);
      this.updateTaskState(task, 'inProgress');
    } else {
      this.updateTaskState(task, 'rejected');
      this.setUserState(this.findUser(p2pFileInfo.remoteId), false);
    }
  }

  createConnectionInfo(remoteId: string,
                       file: File | P2PFileInfo,
                       task: Task): ConnectionInfo {
    this.setUserState(this.findUser(remoteId), true);
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
    for (const user of this.users.getValue()) {
      if (refer === user.id) {
        return user;
      }
    }
    return null;
  }

  setUserState(user: User, isTransferring: boolean): void {
    this.zone.run(() => {
      user.isTransferring = isTransferring;
    });
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

  readSlice(file, offset, reader): void {
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
        // send SLICE_COUNT slice one time
        if (connectionInfo.sliceCount < SLICE_COUNT) {
          this.readSlice(file, connectionInfo.readOffset, fileReader);
          connectionInfo.sliceCount++;
        } else {
          this.updateTaskProgress(task, this.calcProgress(connectionInfo.readOffset, file.size));
          connectionInfo.sliceCount = 1;
        }
      } else {
        this.updateTaskProgress(task, 100);
      }
    });
    this.readSlice(file, 0, fileReader);
    connectionInfo.isSending = true;
    connectionInfo.sliceCount++;
  }

  continueSend(connectionInfo: ConnectionInfo): void {
    this.readSlice(connectionInfo.file, connectionInfo.readOffset, connectionInfo.reader);
  }

  closeConnection(refer: RTCPeerConnection | string): void {
    const connectionInfo = this.findConnectionInfo(refer);
    this.setUserState(this.findUser(connectionInfo.remoteId), false);
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

    if (task.lastTime === 0) {
      task.lastTime = new Date().getTime();
    }
    if (connectionInfo.receivedSize === connectionInfo.fileSize) {
      this.updateTask(task, (val: Task) => {
          val.progress = 100;
          val.state = 'finished';
          val.blob = new Blob(connectionInfo.receivedBuffer);
          val.url = URL.createObjectURL(val.blob);
          return val;
        });
      // connectionInfo.receiveBuffer = [];
      console.log('Received blob: ' + task.blob);

      this.closeConnection(pc);
      const receiveState: ReceiveState = {
        state: 'finished',
        remoteId: connectionInfo.remoteId
      };
      this.socket.emit('receiveState', receiveState);
    } else {
      // TODO: the synchronous progress need to improve
      connectionInfo.sliceCount++;
      if (connectionInfo.sliceCount === SLICE_COUNT) {
        this.updateTaskProgress(task, this.calcProgress(connectionInfo.receivedSize, connectionInfo.fileSize));
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

  onDataChannelError(error: RTCErrorEvent): void {
    console.error('Error in sendChannel:', error);
  }

  sendName(name: string) {
    // this.name = name;
    this.name.next(name);
    this.socket.emit('name', { name });
  }
}
