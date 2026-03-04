import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InventoryBudgetOverviewComponent } from './inventory-budget-overview.component';

describe('InventoryBudgetOverviewComponent', () => {
  let component: InventoryBudgetOverviewComponent;
  let fixture: ComponentFixture<InventoryBudgetOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryBudgetOverviewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InventoryBudgetOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
