import { redirect } from "next/navigation";

/**
 * The bare address. On a school's copy there is nothing here but the cart, so
 * old bookmarks and the iPad's home-screen icon still reach the student list.
 */
export default function Home(): never {
  redirect("/cart");
}
