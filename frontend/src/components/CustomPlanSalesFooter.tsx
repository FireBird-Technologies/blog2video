import { Link } from "react-router-dom";

interface Props {
  className?: string;
}

export default function CustomPlanSalesFooter({ className = "" }: Props) {
  return (
    <p className={`text-center text-sm text-gray-500 ${className}`.trim()}>
      Need a custom plan?{" "}
      <Link
        to="/contact"
        className="text-purple-600 underline font-medium hover:text-purple-700"
      >
        Talk to sales
      </Link>
    </p>
  );
}
