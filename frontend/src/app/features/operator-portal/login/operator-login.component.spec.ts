import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OperatorLoginComponent } from './operator-login.component';

describe('OperatorLoginComponent', () => {
  let component: OperatorLoginComponent;
  let fixture: ComponentFixture<OperatorLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorLoginComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(OperatorLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
