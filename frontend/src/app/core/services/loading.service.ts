import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { delay } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private _loading = new BehaviorSubject<boolean>(false);

  // delay(0) defers emission by one microtask tick,
  // preventing NG0100 ExpressionChangedAfterChecked
  readonly isLoading$ = this._loading.pipe(delay(0));

  show(): void { this._loading.next(true); }
  hide(): void { this._loading.next(false); }
}
