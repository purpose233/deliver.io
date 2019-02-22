import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

@Injectable({
  providedIn: 'root'
})
export class DeliverService {

  constructor(private socket: Socket) { }

  sendName(name: string) {
    this.socket.emit('name', name);
  }
}
