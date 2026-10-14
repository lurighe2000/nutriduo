import type { Profile } from "../schemas";
export default function ProfileAvatar({
  profile,
  className = "avatar",
  alt = "",
}: {
  profile: Pick<Profile, "name" | "avatar">;
  className?: string;
  alt?: string;
}) {
  return (
    <span className={`${className} profile-avatar`}>
      {profile.avatar ? (
        <img src={profile.avatar} alt={alt} />
      ) : (
        profile.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
