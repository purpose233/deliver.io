import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DeliverService, User } from '../deliver.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  users: User[];

  constructor(private deliverService: DeliverService,
              private snackBar: MatSnackBar) {
  }

  ngOnInit() {
    this.deliverService.usersObservable.subscribe(users => this.users = users);
  }

  triggerFileInput(remoteId: string) {
    const input = document.getElementById('fileInput' + remoteId);
    input.click();
  }

  send(event: Event, remoteId: string) {
    const input = event.target;
    const file: File = (<any>input).files[0];
    if (this.deliverService.checkFile(file)) {
      this.deliverService.commitSend(remoteId, file);
    } else {
      this.snackBar.open('Error: File cannot be empty', null, {
        duration: 2000,
        verticalPosition: 'top'
      });
    }
    (<any>event.target).value = '';
  }
}
