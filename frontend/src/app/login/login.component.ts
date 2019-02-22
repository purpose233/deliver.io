import { Component, OnInit } from '@angular/core';
import { DeliverService } from '../deliver.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  name: string;

  constructor(private deliverService: DeliverService) { }

  ngOnInit() {
  }

  sendName(): void {
    this.deliverService.sendName(this.name);
  }
}
