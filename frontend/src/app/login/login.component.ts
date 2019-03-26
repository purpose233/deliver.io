import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DeliverService } from '../deliver.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  name: string;

  constructor(private deliverService: DeliverService,
              private router: Router,
              private snackBar: MatSnackBar) { }

  ngOnInit() {
  }

  login(): void {
    if (this.name == null || this.name === '') {
      this.snackBar.open('Error: Name cannot be empty', null, {
        duration: 2000,
        verticalPosition: 'top'
      });
    } else {
      this.deliverService.sendName(this.name);
      this.router.navigateByUrl('home');
    }
  }
}
