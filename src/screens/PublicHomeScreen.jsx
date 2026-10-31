import { PUBLIC_HOME_MARKUP } from './publicHomeMarkup.js';

// Static, source-owned HTML is also present before JavaScript loads so users
// and crawlers see the same product information.
export default function PublicHomeScreen() {
  return <div dangerouslySetInnerHTML={{ __html: PUBLIC_HOME_MARKUP }} />;
}
