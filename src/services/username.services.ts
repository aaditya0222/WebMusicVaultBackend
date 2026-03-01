import User from "../models/user.model";
import { customAlphabet } from "nanoid";

async function generateVerifiedUsername(
  email: string,
  maxLength = 30,
): Promise<string> {
  const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);

  let username = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9._]/g, "")
    .toLowerCase();

  if (username.length > maxLength - 6)
    username = username.slice(0, maxLength - 6);
  if (username.length < 3) username = username.padEnd(3, "0");

  const baseUsername = username;
  let attempts = 0;

  while (await User.findOne({ username })) {
    if (attempts >= 3) {
      const timestamp = Date.now().toString().slice(-6);
      username = `${baseUsername.slice(0, maxLength - 7)}_${timestamp}`;
      break;
    }
    username = `${baseUsername}_${nanoid()}`;
    attempts++;
  }

  return username;
}

const getUsernameSuggestions = ({
  n,
  identifier,
  maxLength = 30,
}: {
  n: number;
  identifier: string;
  maxLength?: number;
}) => {
  if (n > 9) n = 9;
  identifier = identifier.toLowerCase().replace(/\s/g, "");
  if (identifier.includes("@")) {
    identifier = identifier.split("@")[0];
  }
  // const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);
  const nanoid = customAlphabet("0123456789", 3);
  if (identifier.length > maxLength - 6)
    identifier = identifier.slice(0, maxLength - 6);
  if (identifier.length < 3) identifier = identifier.padEnd(3, "0");

  const baseUsername = identifier;
  let usernameSuggestions: string[] = [];
  while (n !== 0) {
    identifier = `${baseUsername}_${nanoid()}`;
    usernameSuggestions.push(identifier);
    n--;
  }
  return usernameSuggestions;
};

export { getUsernameSuggestions, generateVerifiedUsername };
