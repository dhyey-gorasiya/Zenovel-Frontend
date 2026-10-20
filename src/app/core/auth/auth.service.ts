import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { DataStore } from '../data/data-store.service';
import { LocalStorageService } from '../data/local-storage.service';
import { SessionUser, User } from '../models';

const SESSION_KEY = 'zen.v2.session';

/**
 * Prototype-only authentication against seeded demo accounts stored in the browser.
 * This is NOT secure and must be replaced by server-side authentication.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly data = inject(DataStore);
  private readonly storage = inject(LocalStorageService);
  private readonly sessionUserId = signal<string | null>(this.storage.get<string>(SESSION_KEY));

  readonly user = computed<SessionUser | null>(() => {
    const id = this.sessionUserId();
    const u = id ? this.data.users.get(id) : undefined;
    return u ? this.strip(u) : null;
  });
  readonly isLoggedIn = computed(() => this.user() !== null);

  login(email: string, password: string): Observable<SessionUser> {
    const u = this.data.users.items().find(x => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) {
      return throwError(() => new Error('Invalid email or password.')).pipe(delay(350));
    }
    this.sessionUserId.set(u.id);
    this.storage.write(SESSION_KEY, u.id);
    return of(this.strip(u)).pipe(delay(350));
  }

  logout(): void {
    this.sessionUserId.set(null);
    this.storage.remove(SESSION_KEY);
  }

  /** Demo accounts listed on the login page so testers can sign in as each role. */
  demoAccounts(): Pick<User, 'name' | 'email' | 'role' | 'organization' | 'password'>[] {
    return this.data.users.items().map(({ name, email, role, organization, password }) => ({ name, email, role, organization, password }));
  }

  private strip(u: User): SessionUser {
    const { password: _password, ...rest } = u;
    return rest;
  }
}
