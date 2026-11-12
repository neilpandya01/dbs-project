import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <>
      <p className="auth-tag" role="note"><b>Pick your username carefully:</b> it’s how friends find you, and it can’t be changed later.</p>
      <SignUp />
    </>
  );
}
