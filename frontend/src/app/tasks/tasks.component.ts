import { Component, OnInit } from '@angular/core';
import { DeliverService } from '../deliver.service';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.scss']
})
export class TasksComponent implements OnInit {

  // tasks = [
  //   {type: 'send',    remoteName: 'fdsaa', fileName: 'movies001.mp4', fileSize: 10024,  progress: 50,  url: null, speed: 256000},
  //   {type: 'receive', remoteName: 'fasfads', fileName: 'movies001.mp4', fileSize: 102004, progress: 50,  url: null,  speed: 2560},
  //   {type: 'send',    remoteName: '啊啊啊', fileName: 'movies001.mp4', fileSize: 10024,  progress: 100, url: 'fasdfsa', speed: 0},
  //   {type: 'receive', remoteName: '发的发生发达撒发放', fileName: 'movies001.mp4', fileSize: 102004, progress: 100, url: 'sdfsaf', speed: 0},
  // ];

  constructor(private deliverService: DeliverService) { }

  ngOnInit() {
  }

  formatBytes(bytes: number, fractionDigits: number = 2): string {
    if (bytes < 1024) {
      return bytes + 'Byte';
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

  downloadFile(url: string, fileName: string) {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
