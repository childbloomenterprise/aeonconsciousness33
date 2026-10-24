import type { ReactNode } from "react";
import {
  Stepper,
  StepperNav,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperSeparator,
} from "./stepper";

/** Adapted from the supplied vertical stepper; each answer section remains visible. */
export default function VerticalTitledStepper({
  sections,
  appearance = "answer",
}: {
  sections: Array<{ title: string; content: ReactNode }>;
  appearance?: "answer" | "journey";
}) {
  if (appearance === "journey") {
    return (
      <ol className="journey-setup-stepper" aria-label="Journey setup">
        {sections.map((section, index) => (
          <li key={section.title}>
            <span className="journey-setup-marker" aria-hidden="true">
              {index + 1}
            </span>
            <section className="journey-setup-section">
              <h3>{section.title}</h3>
              <div className="form-stack">{section.content}</div>
            </section>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <Stepper defaultValue={1} orientation="vertical" className="answer-stepper">
      <StepperNav>
        {sections.map((section, index) => (
          <StepperItem
            key={section.title}
            step={index + 1}
            className="answer-step"
          >
            <div className="answer-step-track">
              <StepperTrigger aria-label={`Focus ${section.title}`}>
                <StepperIndicator>
                  {String(index + 1).padStart(2, "0")}
                </StepperIndicator>
              </StepperTrigger>
              {index < sections.length - 1 && (
                <StepperSeparator className="answer-step-line" />
              )}
            </div>
            <section>
              <StepperTitle>{section.title}</StepperTitle>
              <div className="answer-step-copy">{section.content}</div>
            </section>
          </StepperItem>
        ))}
      </StepperNav>
    </Stepper>
  );
}
