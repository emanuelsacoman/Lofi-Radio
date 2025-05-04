import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VhsComponent } from './vhs.component';

describe('VhsComponent', () => {
  let component: VhsComponent;
  let fixture: ComponentFixture<VhsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VhsComponent]
    });
    fixture = TestBed.createComponent(VhsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
