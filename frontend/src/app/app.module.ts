import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule, MatInputModule, MatIconModule,
  MatCardModule, MatGridListModule, MatListModule,
  MatProgressBarModule, MatSnackBarModule } from '@angular/material';

import { UsersComponent } from './users/users.component';
import { JobsComponent } from './jobs/jobs.component';
import { FilesComponent } from './files/files.component';
import { MeComponent } from './me/me.component';

import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { HomeComponent } from './home/home.component';
const config: SocketIoConfig = { url: 'http://localhost:4000', options: {} };

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    UsersComponent,
    JobsComponent,
    FilesComponent,
    MeComponent,
    HomeComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    BrowserAnimationsModule,
    SocketIoModule.forRoot(config),
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatCardModule,
    MatGridListModule,
    MatListModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
