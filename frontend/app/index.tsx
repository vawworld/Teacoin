import { Redirect } from 'expo-router';

export default function Index() {
  // Just redirect to auth by default
  return <Redirect href="/auth/login" />;
}