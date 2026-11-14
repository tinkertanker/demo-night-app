import { type Postcard } from "~/lib/postcards";

export default function PostcardContent({ feedback }: { feedback: Postcard }) {
  return (
    <div className="space-y-2 text-gray-700">
      {feedback.comment && (
        <p className="whitespace-pre-wrap italic">{feedback.comment}</p>
      )}
      {(
        [
          ["liked", "I liked…"],
          ["wonder", "I wonder…"],
          ["tryNext", "You could try…"],
        ] as const
      ).map(
        ([key, label]) =>
          feedback[key] && (
            <p key={key} className="whitespace-pre-wrap">
              <strong>{label} </strong>
              {feedback[key]}
            </p>
          ),
      )}
      {!!feedback.badges?.length && (
        <div className="flex flex-wrap gap-2">
          {feedback.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-amber-100 px-3 py-1 text-sm"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
