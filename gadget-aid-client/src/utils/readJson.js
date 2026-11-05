export const readJson = async (response) => {
  if (!response.ok) {
    const error = new Error(response.status === 404 ? "This service could not be found." : "We could not complete that request. Please try again.");
    error.status = response.status;
    throw error;
  }
  return response.json();
};
