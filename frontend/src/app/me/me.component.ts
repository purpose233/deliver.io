import { Component, OnInit } from '@angular/core';
import { DeliverService } from '../deliver.service';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material';

@Component({
  selector: 'app-me',
  templateUrl: './me.component.html',
  styleUrls: ['./me.component.scss']
})
export class MeComponent implements OnInit {

  constructor(private iconRegistry: MatIconRegistry,
              private sanitizer: DomSanitizer,
              private deliverService: DeliverService) {
    iconRegistry.addSvgIcon(
      'user-secret',
      sanitizer.bypassSecurityTrustResourceUrl('assets/img/user-secret-solid.svg'));
  }

  ngOnInit() {
  }

}
