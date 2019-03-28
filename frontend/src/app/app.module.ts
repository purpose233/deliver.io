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
  MatProgressBarModule, MatSnackBarModule, MatTooltipModule } from '@angular/material';

import { UsersComponent } from './users/users.component';
import { MeComponent } from './me/me.component';
import { HomeComponent } from './home/home.component';
import { TasksComponent } from './tasks/tasks.component';

import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
const config: SocketIoConfig = { url: '', options: {} };

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    UsersComponent,
    MeComponent,
    HomeComponent,
    TasksComponent
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
    MatSnackBarModule,
    MatTooltipModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
