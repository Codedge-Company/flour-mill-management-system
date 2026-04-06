import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestedStockSectionComponent } from './requested-stock-section.component';

describe('RequestedStockSectionComponent', () => {
  let component: RequestedStockSectionComponent;
  let fixture: ComponentFixture<RequestedStockSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestedStockSectionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RequestedStockSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
