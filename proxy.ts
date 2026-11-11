import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything needs a signed-in user except the sign-in/sign-up pages and static assets.
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/manifest.webmanifest", "/icon.svg", "/maplibre/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless they're found in the search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
