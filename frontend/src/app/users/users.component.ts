import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DeliverService } from '../deliver.service';
import {Router} from "@angular/router";

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {

  constructor(private deliverService: DeliverService,
              private snackBar: MatSnackBar) { }

  ngOnInit() {
  }

  triggerFileInput(remoteId: string) {
    let input = document.getElementById('fileInput' + remoteId);
    input.click();
  }

  send(remoteId: string) {
    let input = document.getElementById('fileInput' + remoteId);
    let file: File = (<any>input).files[0];
    if (this.deliverService.checkFile(file)) {
      this.deliverService.commitSend(remoteId, file);
    } else {
      this.snackBar.open("Error: File cannot be empty", null, {
        duration: 2000,
        verticalPosition: 'top'
      });
    }
  }

  async prepareConnection() {

  }
}
