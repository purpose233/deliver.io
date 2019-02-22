import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

@Injectable({
  providedIn: 'root'
})
export class DeliverService {
  name: string;

  constructor(private socket: Socket) { }

  sendName(name: string) {
    this.name = name;
    this.socket.emit('name', name);
  }

  getName(): string {
    return this.name;
  }
}
