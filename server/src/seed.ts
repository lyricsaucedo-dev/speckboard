import { PIXEL_PRICE_CENTS, db, nowIso } from './db.js';

/** Stable id so redeploys never duplicate Pop Cat. */
export const POP_CAT_AD_ID = 'seed-pop-cat';
export const POP_CAT_TITLE = 'Dont tell my dad i used his card';

/** Embedded 20×20 Pop Cat PNG — works in Docker without client/public on disk. */
const POP_CAT_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAD7klEQVR4nI2U/U/VVRzHX+f7cC+CIBgoK8yRBIW2dK1cgZuzgs1VrrQFRrQpIG3FVltirZVPlGKZKJYb4kObP7Tmf1Cbm6hLJs6pSxCSx0vcEImHe7nf+/1+Tzvfe3lwy+Zn+z6ec97n/fm83+cjpHRl8/EGfL75vFdewUOFhFOnG4ncC3Gt9RILs7PYW3fEG9IsK8Lgld/46dg+VuRnIHFmV8Xvcy8VBS/m8vOJYzyV+ghLktJBajN7Ga7QKFy9kYLnLa533WTrhnVk5j6NrWns33eUz3fUoM1AgYtDdGqKZH8qHR23eWlNAb/+cXUW0HTUZAdXCqzgJCUlFVxtOUvLtT/Jy0ljy+svI1wQ6FTU1iMRvPXaO7i2xZZtm/nhi+/mbAdCSimfyVtEQ+03hP4ZJzAwwPjEOI5vEN2RFJVUkZ69HM0VIByEFEgBWyurWF+0nuQkk87+LnbtORSrYSwN3atQYmIiuXn56NLAsgVlOw6xOGcle+v2U7imEFdx0QTSlZxsPs7Bhga+3F2HbbuzKYPNzfYBVi3PpLq4nOycXKLmAJWffo+ULsXrXkFKjZbzLbjWFGcOHsb0GWyqqebihXPc7ujk99bzjAb7SV2UFUtZIa96Mp2ytZuw/cMIEcGSOlW1ClQwFPyL0Pg4dV/v5E7fLY9l1HI53fQLy3KWMTZ6jw0bX+VGx/AsYCg0Qf3Hb5NsGNydjNLafoemk2cxNJPWtivU79rOAtOHqWqoZNTgbiRMzSef8dwLqwkGR+gPdMVq6PlN2rTe6iPs6tzo7EZogkBvgJ7eAAd2b2ehnoDhgq1WCOU3SDcTONH4LYePNIArEUJMiyIxdT9hy+Hi9S6E9LHzq0ZvpamDIXSEFhNEPTwCQn1KEjHQcNCFQAgtBqiphf4ExiITSE3HUqKjzOcoYyEUpf8IEQdXo66mlI4z9H4KweW2PoIjI9TW7vFSFkJXsCxI8pGgm/cDSXB0wWNJaUhld0UZoWwTP7FSsHLFEpqPnsKKqG/pbT0VifBo/rPo7d1EdPh7bNRLNzMpBSFdLgz30Fx2ANu2cFw5zVCdApe01PlELQehzlo8/LpB+eZKLk32MRoNk5GYQkZSsse+LRyk6ccz2LbNtg9Leff9ylnbTI5PcLnlHH7d98CuZdlT8XoKzxU+M5HA4AC9fT1Uf/QB81IWTzOUTE0GeSIn+4FgHlufH9PwY5oGQ0ND9A90s3RpFlEZZl5KBkIpPz25uGgtg/2B/wWcM52srMe9y3VdQmFnpifGRZlWT6UztxndH6opxF6U0WJCekDCRsT3igMKZDREZVUpumF48x42VPN9483SmG/R+BcxsaWIWrGKjQAAAABJRU5ErkJggg==';

export function ensureDefaultSpeck(): { seeded: boolean; message: string } {
  const existing = db.read().ads.find(
    (a) => a.id === POP_CAT_AD_ID || a.title === POP_CAT_TITLE
  );
  if (existing) {
    return { seeded: false, message: 'Pop Cat already on board' };
  }

  const stamp = nowIso();
  const width = 20;
  const height = 20;

  db.update((s) => {
    s.ads.push({
      id: POP_CAT_AD_ID,
      user_id: null,
      x: 240,
      y: 90,
      width,
      height,
      title: POP_CAT_TITLE,
      link_url: '',
      image_url: POP_CAT_DATA_URL,
      shape: 'square',
      locked: 1,
      stripe_session_id: null,
      amount_cents: width * height * PIXEL_PRICE_CENTS,
      status: 'active',
      created_at: stamp,
      updated_at: stamp,
    });
  });

  return { seeded: true, message: 'Seeded Pop Cat speck' };
}
