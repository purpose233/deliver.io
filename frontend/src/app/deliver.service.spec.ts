import { TestBed } from '@angular/core/testing';

import { DeliverService } from './deliver.service';

describe('DeliverService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: DeliverService = TestBed.get(DeliverService);
    expect(service).toBeTruthy();
  });
});
