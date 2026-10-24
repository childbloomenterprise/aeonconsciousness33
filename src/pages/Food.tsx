import { Modal } from "../components/ui";
import { CuisineExplorer } from "../components/CuisineExplorer";
import { useLinc } from "../state";
export function Food({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { selectedJourney } = useLinc();
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={`A taste of ${selectedJourney?.destination_name || "your destination"}`}
      description="Explore local food and find places to try it."
    >
      <CuisineExplorer destination={selectedJourney?.destination_name || ""} />
    </Modal>
  );
}
