import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmComponent } from './adm.component';

describe('AdmComponent', () => {
  let component: AdmComponent;
  let fixture: ComponentFixture<AdmComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AdmComponent]
    });
    fixture = TestBed.createComponent(AdmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
