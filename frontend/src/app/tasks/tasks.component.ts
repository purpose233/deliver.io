import { Component, OnInit } from '@angular/core';
import { DeliverService, Task } from '../deliver.service';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.scss']
})
export class TasksComponent implements OnInit {
  tasks;

  constructor(private deliverService: DeliverService) { }

  ngOnInit() {
    this.deliverService.tasksObservable.subscribe(tasks => this.tasks = tasks);
  }

  formatBytes(bytes: number, fractionDigits: number = 2): string {
    if (bytes < 1024) {
      return bytes.toFixed(fractionDigits) + 'Byte';
    } else if (bytes < 1024 ** 2) {
      return (bytes / 1024).toFixed(fractionDigits) + 'KB';
    } else if (bytes < 1024 ** 3) {
      return (bytes / 1024 ** 2).toFixed(fractionDigits) + 'MB';
    } else {
      return (bytes / 1024 ** 3).toFixed(fractionDigits) + 'GB';
    }
  }

  formatFileSize(size: number): string {
    return this.formatBytes(size, 2);
  }

  formatSpeed(speed: number): string {
    return this.formatBytes(speed, 1) + '/s';
  }

  downloadFile(url: string, fileName: string): void {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  rejectFile(task: Task): void {
    this.deliverService.confirmReceive(false, task);
  }

  acceptFile(task: Task): void {
    this.deliverService.confirmReceive(true, task);
  }

  clearTask(task: Task): void {
    this.deliverService.deleteTask(task);
  }

  cancelSend(task: Task): void {
    this.deliverService.cancelSend(task);
  }

  abortTransfer(task: Task): void {
    this.deliverService.abortTask(task);
  }
}
