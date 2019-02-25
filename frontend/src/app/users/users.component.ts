import { Component, OnInit } from '@angular/core';
import { DeliverService } from '../deliver.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {

  constructor(private deliverService: DeliverService) { }

  ngOnInit() {
  }

  async prepareConnection() {

  }
}
