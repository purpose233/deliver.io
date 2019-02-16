import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  files = [
    {name: 'movies001.mp4', size: '1024', time: '2019/2/16 10:10:10'},
    {name: 'movies001.mp4', size: '1024', time: '2019/2/16 10:10:10'},
    {name: 'movies001.mp4', size: '1024', time: '2019/2/16 10:10:10'},
    {name: 'movies001.mp4', size: '1024', time: '2019/2/16 10:10:10'},
    {name: 'movies001.mp4', size: '1024', time: '2019/2/16 10:10:10'}
  ];

  constructor() { }

  ngOnInit() {
  }

}
