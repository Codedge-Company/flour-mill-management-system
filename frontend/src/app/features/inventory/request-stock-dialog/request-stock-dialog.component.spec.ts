import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestStockDialogComponent } from './request-stock-dialog.component';

describe('RequestStockDialogComponent', () => {
  let component: RequestStockDialogComponent;
  let fixture: ComponentFixture<RequestStockDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestStockDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RequestStockDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
