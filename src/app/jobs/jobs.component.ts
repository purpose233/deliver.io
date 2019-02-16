import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: ['./jobs.component.scss']
})
export class JobsComponent implements OnInit {
  jobs = [
    {type: 'done', name: 'movies001.mp4', progress: 100},
    {type: 'download', name: 'movies001.mp4', progress: 10},
    {type: 'download', name: 'movies001.mp4', progress: 50},
    {type: 'upload', name: 'movies.mp4', progress: 20}
  ];

  constructor() { }

  ngOnInit() {
  }

}
