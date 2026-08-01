route_prefix = :checkout

Rails.application.routes.draw do
  resources :checkouts
  resource :session
  get "/checkout/:id", to: "checkouts#show"
  post "/checkout", to: "checkouts#create"
  match "/legacy", to: "checkouts#legacy", via: :all
  resources route_prefix
end
