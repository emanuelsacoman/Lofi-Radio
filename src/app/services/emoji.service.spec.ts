import { TestBed } from '@angular/core/testing';
import { AngularFireDatabase } from '@angular/fire/compat/database';

import { EmojiService } from './emoji.service';

describe('EmojiService', () => {
  let service: EmojiService;

  beforeEach(() => {
    const database = jasmine.createSpyObj<AngularFireDatabase>('AngularFireDatabase', [
      'list'
    ]);

    TestBed.configureTestingModule({
      providers: [{ provide: AngularFireDatabase, useValue: database }]
    });
    service = TestBed.inject(EmojiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
